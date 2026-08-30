import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Event, type IEvent, type EventStatus, type PaymentMethod } from "@/models/Event";
import { Reservation, type IReservation } from "@/models/Reservation";
import { CheckIn } from "@/models/CheckIn";
import { BandSubmission, type SubmissionStatus } from "@/models/BandSubmission";
import { User } from "@/models/User";
import { fromLocalInputValue } from "@/lib/format";

/**
 * Plain, JSON-safe shapes. Mongoose documents carry ObjectIds and Dates that
 * cannot cross the server/client boundary, so everything leaving this module is
 * serialised once, here, instead of ad hoc at each call site.
 */
export type EventDTO = {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  locationAr: string;
  locationEn: string;
  mapUrl: string;
  coverImage: string;
  isPoster: boolean;
  startsAt: string;
  doorsOpenAt: string | null;
  price: number;
  capacity: number | null;
  paymentMethods: PaymentMethod[];
  instapayNumber: string;
  termsAr: string;
  termsEn: string;
  status: EventStatus;
  /**
   * Whether the night has already started, resolved here rather than in a
   * component: reading the clock during render is impure, and every page that
   * shows an event is `force-dynamic`, so this is evaluated per request anyway.
   */
  isPast: boolean;
  /**
   * Set once the admin has generated this event's "Show on PDF" report at
   * least once (Admin_Event_PDF.md). `null` until then. Only the openable
   * links and the timestamp cross to the client — the Sheets/Drive file ids
   * stay server-side.
   */
  report: { spreadsheetUrl: string; pdfUrl: string; generatedAt: string } | null;
};

export type ReservationDTO = {
  id: string;
  eventId: string;
  userId: string;
  name: string;
  phone: string;
  code: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
  checkedIn?: boolean;
};

export type CheckInDTO = {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
  amount: number;
  reservationId: string | null;
  createdAt: string;
  note: string;
};

export type SubmissionDTO = {
  id: string;
  bandName: string;
  genre: string;
  contactName: string;
  email: string;
  phone: string;
  links: string[];
  preferredDates: string;
  pitch: string;
  status: SubmissionStatus;
  adminNote: string;
  createdAt: string;
};

/** What `.lean()` hands back for an event: the schema fields plus the id. */
type LeanEvent = IEvent;

export function toEventDTO(e: LeanEvent): EventDTO {
  const startsAt = new Date(e.startsAt);
  return {
    id: String(e._id),
    isPast: startsAt.getTime() < Date.now(),
    titleAr: e.titleAr ?? "",
    titleEn: e.titleEn ?? "",
    descriptionAr: e.descriptionAr ?? "",
    descriptionEn: e.descriptionEn ?? "",
    locationAr: e.locationAr ?? "",
    locationEn: e.locationEn ?? "",
    mapUrl: e.mapUrl ?? "",
    coverImage: e.coverImage ?? "",
    isPoster: e.isPoster ?? false,
    startsAt: startsAt.toISOString(),
    doorsOpenAt: e.doorsOpenAt ? new Date(e.doorsOpenAt).toISOString() : null,
    price: Number(e.price ?? 0),
    capacity: e.capacity == null ? null : Number(e.capacity),
    paymentMethods: e.paymentMethods ?? ["cash"],
    instapayNumber: e.instapayNumber ?? "",
    termsAr: e.termsAr ?? "",
    termsEn: e.termsEn ?? "",
    status: e.status ?? "draft",
    report:
      e.report && e.report.generatedAt
        ? {
            spreadsheetUrl: e.report.spreadsheetUrl ?? "",
            pdfUrl: e.report.pdfUrl ?? "",
            generatedAt: new Date(e.report.generatedAt).toISOString(),
          }
        : null,
  };
}

/** Title in the reader's language, falling back to the other one if blank. */
export function eventTitle(event: EventDTO, locale: "ar" | "en"): string {
  return locale === "ar"
    ? event.titleAr || event.titleEn
    : event.titleEn || event.titleAr;
}

export function eventText(
  event: EventDTO,
  locale: "ar" | "en",
  field: "description" | "location" | "terms"
): string {
  const ar = event[`${field}Ar` as keyof EventDTO] as string;
  const en = event[`${field}En` as keyof EventDTO] as string;
  return locale === "ar" ? ar || en : en || ar;
}

/** Statuses a visitor without a staff/admin role is allowed to see. */
const PUBLIC_STATUSES: EventStatus[] = ["published", "closed", "happened", "archived"];

export async function getPublicEvents({
  when = "upcoming",
  limit = 50,
}: { when?: "upcoming" | "past"; limit?: number } = {}): Promise<EventDTO[]> {
  await connectDB();
  const now = new Date();
  const docs = await Event.find({
    status: { $in: when === "upcoming" ? ["published", "closed"] : PUBLIC_STATUSES },
    startsAt: when === "upcoming" ? { $gte: now } : { $lt: now },
  })
    .sort({ startsAt: when === "upcoming" ? 1 : -1 })
    .limit(limit)
    .lean();

  return docs.map((d) => toEventDTO(d));
}

export async function getAllEvents(): Promise<EventDTO[]> {
  await connectDB();
  const docs = await Event.find().sort({ startsAt: -1 }).lean();
  return docs.map((d) => toEventDTO(d));
}

export async function getEvent(id: string): Promise<EventDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const doc = await Event.findById(id).lean();
  return doc ? toEventDTO(doc) : null;
}

/** Confirmed reservations only — cancelled ones free their spot back up. */
export async function countReservations(eventId: string): Promise<number> {
  await connectDB();
  return Reservation.countDocuments({ event: eventId, status: "confirmed" });
}

export async function countReservationsForEvents(
  eventIds: string[]
): Promise<Record<string, number>> {
  if (eventIds.length === 0) return {};
  await connectDB();
  const rows = await Reservation.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
    {
      $match: {
        event: { $in: eventIds.map((id) => new mongoose.Types.ObjectId(id)) },
        status: "confirmed",
      },
    },
    { $group: { _id: "$event", n: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.n]));
}

export async function getMyReservation(
  eventId: string,
  userId: string
): Promise<ReservationDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return null;
  await connectDB();
  const doc = await Reservation.findOne({
    event: eventId,
    user: userId,
    status: "confirmed",
  }).lean();
  return doc ? toReservationDTO(doc) : null;
}

function toReservationDTO(
  doc: Omit<IReservation, "event" | "user"> & {
    event: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId };
    user: mongoose.Types.ObjectId;
  }
): ReservationDTO {
  const eventId =
    doc.event instanceof mongoose.Types.ObjectId ? doc.event : doc.event._id;
  return {
    id: String(doc._id),
    eventId: String(eventId),
    userId: String(doc.user),
    name: doc.name ?? "",
    phone: doc.phone ?? "",
    code: doc.code ?? "",
    status: doc.status ?? "confirmed",
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/** A member's reservations with the event attached, newest event first. */
export async function getMyReservations(
  userId: string
): Promise<{ reservation: ReservationDTO; event: EventDTO }[]> {
  await connectDB();
  const docs = await Reservation.find({ user: userId, status: "confirmed" })
    .populate<{ event: IEvent | null }>("event")
    .lean();

  return docs
    .filter((d): d is typeof d & { event: IEvent } => Boolean(d.event))
    .map((d) => ({
      reservation: toReservationDTO(d),
      event: toEventDTO(d.event),
    }))
    .sort(
      (a, b) =>
        new Date(b.event.startsAt).getTime() - new Date(a.event.startsAt).getTime()
    );
}

/** Door list for an event, flagged with who has already been checked in. */
export async function getEventReservations(
  eventId: string
): Promise<ReservationDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return [];
  await connectDB();
  const [docs, checkIns] = await Promise.all([
    Reservation.find({ event: eventId, status: "confirmed" })
      .sort({ createdAt: 1 })
      .lean(),
    CheckIn.find({ event: eventId, reservation: { $ne: null } })
      .select("reservation")
      .lean(),
  ]);

  const checkedIn = new Set(checkIns.map((c) => String(c.reservation)));
  return docs.map((d) => ({
    ...toReservationDTO(d),
    checkedIn: checkedIn.has(String(d._id)),
  }));
}

export async function getCheckIns(eventId: string): Promise<CheckInDTO[]> {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return [];
  await connectDB();
  const docs = await CheckIn.find({ event: eventId }).sort({ createdAt: -1 }).lean();
  return docs.map((d) => ({
    id: String(d._id),
    eventId: String(d.event),
    name: d.name,
    phone: d.phone,
    paymentMethod: d.paymentMethod,
    amount: d.amount,
    reservationId: d.reservation ? String(d.reservation) : null,
    createdAt: new Date(d.createdAt).toISOString(),
    note: d.note ?? "",
  }));
}

/** One person's line on the combined report list (Admin_Event_PDF.md §5). */
export type ReportPersonRow = {
  name: string;
  phone: string;
  /** Held a spot ahead of time. */
  reserved: boolean;
  /** Reservation door code, or "" for a walk-in. */
  code: string;
  /** Came through the door. */
  checkedIn: boolean;
  /**
   * `attended` — reserved and checked in.
   * `no-show` — reserved, never checked in.
   * `walk-in` — checked in with no live reservation.
   */
  status: "attended" | "no-show" | "walk-in";
  /** How they paid at the door — null for a no-show. */
  paymentMethod: PaymentMethod | null;
  amount: number | null;
  /** ISO instant they were checked in — null for a no-show. */
  checkInAt: string | null;
};

export type EventReportData = {
  event: {
    id: string;
    titleAr: string;
    titleEn: string;
    startsAt: string;
    price: number;
    capacity: number | null;
  };
  /** One row per person connected to the night, in any way. */
  rows: ReportPersonRow[];
};

const REPORT_STATUS_ORDER: Record<ReportPersonRow["status"], number> = {
  attended: 0,
  "walk-in": 1,
  "no-show": 2,
};

/**
 * Everything the "Show on PDF" report needs for one event, in a single round
 * trip: the event's own money/capacity fields plus its reservations and
 * check-ins, merged into the one-row-per-person list of §5. The merge itself
 * is plain array work on the two already-fetched sets — the same join shape
 * `getEventReservations` uses (reservation ⨝ check-in on `reservation`),
 * widened to also surface walk-ins and no-shows. Analytics are derived from
 * this by `lib/report/analytics.ts`, not here.
 */
export async function getEventReportData(
  eventId: string
): Promise<EventReportData | null> {
  if (!mongoose.Types.ObjectId.isValid(eventId)) return null;
  await connectDB();

  const [row] = await Event.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(eventId) } },
    {
      $lookup: {
        from: CheckIn.collection.name,
        localField: "_id",
        foreignField: "event",
        as: "checkins",
      },
    },
    {
      $lookup: {
        from: Reservation.collection.name,
        let: { eventId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$event", "$$eventId"] },
              status: "confirmed",
            },
          },
          { $sort: { createdAt: 1 } },
        ],
        as: "reservations",
      },
    },
    {
      $project: {
        titleAr: 1,
        titleEn: 1,
        startsAt: 1,
        price: 1,
        capacity: 1,
        checkins: {
          _id: 1,
          name: 1,
          phone: 1,
          paymentMethod: 1,
          amount: 1,
          reservation: 1,
          createdAt: 1,
        },
        reservations: { _id: 1, name: 1, phone: 1, code: 1 },
      },
    },
  ]);

  if (!row) return null;

  type CheckinLean = {
    _id: mongoose.Types.ObjectId;
    name: string;
    phone: string;
    paymentMethod: PaymentMethod;
    amount: number;
    reservation: mongoose.Types.ObjectId | null;
    createdAt: Date;
  };
  type ReservationLean = {
    _id: mongoose.Types.ObjectId;
    name: string;
    phone: string;
    code: string;
  };

  const checkins: CheckinLean[] = row.checkins ?? [];
  const reservations: ReservationLean[] = row.reservations ?? [];

  const checkinByReservation = new Map<string, CheckinLean>();
  for (const c of checkins) {
    if (c.reservation) checkinByReservation.set(String(c.reservation), c);
  }

  const rows: ReportPersonRow[] = [];

  // Every confirmed reservation → attended or no-show.
  for (const r of reservations) {
    const ci = checkinByReservation.get(String(r._id));
    rows.push({
      name: r.name ?? "",
      phone: r.phone ?? "",
      reserved: true,
      code: r.code ?? "",
      checkedIn: Boolean(ci),
      status: ci ? "attended" : "no-show",
      paymentMethod: ci ? ci.paymentMethod : null,
      amount: ci ? Number(ci.amount ?? 0) : null,
      checkInAt: ci ? new Date(ci.createdAt).toISOString() : null,
    });
  }

  // Every check-in not consumed by a confirmed reservation → walk-in
  // (covers `reservation: null` and check-ins whose reservation was later
  // cancelled — either way the person was at the door without a live booking).
  const consumed = new Set(
    reservations
      .map((r) => checkinByReservation.get(String(r._id)))
      .filter((c): c is CheckinLean => Boolean(c))
      .map((c) => String(c._id))
  );
  for (const c of checkins) {
    if (consumed.has(String(c._id))) continue;
    rows.push({
      name: c.name ?? "",
      phone: c.phone ?? "",
      reserved: false,
      code: "",
      checkedIn: true,
      status: "walk-in",
      paymentMethod: c.paymentMethod,
      amount: Number(c.amount ?? 0),
      checkInAt: new Date(c.createdAt).toISOString(),
    });
  }

  rows.sort((a, b) => {
    if (a.status !== b.status) {
      return REPORT_STATUS_ORDER[a.status] - REPORT_STATUS_ORDER[b.status];
    }
    if (a.checkInAt && b.checkInAt) return a.checkInAt.localeCompare(b.checkInAt);
    return a.name.localeCompare(b.name, ["ar", "en"]);
  });

  return {
    event: {
      id: String(row._id),
      titleAr: (row.titleAr as string) ?? "",
      titleEn: (row.titleEn as string) ?? "",
      startsAt: new Date(row.startsAt).toISOString(),
      price: Number(row.price ?? 0),
      capacity: row.capacity == null ? null : Number(row.capacity),
    },
    rows,
  };
}

/** Events staff can run a door for: happening around now, not drafts. */
export async function getStaffEvents(): Promise<EventDTO[]> {
  await connectDB();
  const docs = await Event.find({ status: { $in: ["published", "closed", "happened"] } })
    .sort({ startsAt: -1 })
    .limit(40)
    .lean();
  return docs.map((d) => toEventDTO(d));
}

export async function getSubmissions(
  status?: SubmissionStatus
): Promise<SubmissionDTO[]> {
  await connectDB();
  const filter = status ? { status } : {};
  const docs = await BandSubmission.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return docs.map((d) => ({
    id: String(d._id),
    bandName: d.bandName,
    genre: d.genre ?? "",
    contactName: d.contactName,
    email: d.email,
    phone: d.phone ?? "",
    links: d.links ?? [],
    preferredDates: d.preferredDates ?? "",
    pitch: d.pitch ?? "",
    status: d.status,
    adminNote: d.adminNote ?? "",
    createdAt: new Date(d.createdAt).toISOString(),
  }));
}

export type MonthlyReport = {
  month: string;
  totalRevenue: number;
  totalAttendees: number;
  byMethod: Record<PaymentMethod, number>;
  events: {
    id: string;
    titleAr: string;
    titleEn: string;
    startsAt: string;
    attendees: number;
    revenue: number;
    cash: number;
    instapay: number;
    reservations: number;
  }[];
};

/** First instant of a "YYYY-MM" month, and of the month after it, in cafe time. */
function monthRange(month: string): { start: Date; end: Date } {
  const start = fromLocalInputValue(`${month}-01T00:00`) ?? new Date();
  const [y, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const end = fromLocalInputValue(`${nextMonth}-01T00:00`) ?? new Date();
  return { start, end };
}

/**
 * Earnings for a month, attributed by the date the event happened (not the date
 * cash was keyed in), so a night that ran past midnight still counts once.
 */
export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  await connectDB();
  const { start, end } = monthRange(month);

  const rows = await Event.aggregate([
    {
      $match: {
        startsAt: { $gte: start, $lt: end },
        status: { $in: ["published", "closed", "happened", "archived"] },
      },
    },
    { $sort: { startsAt: 1 } },
    {
      $lookup: {
        from: CheckIn.collection.name,
        localField: "_id",
        foreignField: "event",
        as: "checkins",
      },
    },
    {
      $lookup: {
        from: Reservation.collection.name,
        let: { eventId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$event", "$$eventId"] },
              status: "confirmed",
            },
          },
          { $count: "n" },
        ],
        as: "reservationCount",
      },
    },
    {
      $project: {
        titleAr: 1,
        titleEn: 1,
        startsAt: 1,
        attendees: { $size: "$checkins" },
        revenue: { $sum: "$checkins.amount" },
        cash: {
          $sum: {
            $map: {
              input: "$checkins",
              as: "c",
              in: {
                $cond: [{ $eq: ["$$c.paymentMethod", "cash"] }, "$$c.amount", 0],
              },
            },
          },
        },
        instapay: {
          $sum: {
            $map: {
              input: "$checkins",
              as: "c",
              in: {
                $cond: [{ $eq: ["$$c.paymentMethod", "instapay"] }, "$$c.amount", 0],
              },
            },
          },
        },
        reservations: {
          $ifNull: [{ $first: "$reservationCount.n" }, 0],
        },
      },
    },
  ]);

  const events = rows.map((r) => ({
    id: String(r._id),
    titleAr: r.titleAr as string,
    titleEn: r.titleEn as string,
    startsAt: new Date(r.startsAt).toISOString(),
    attendees: Number(r.attendees ?? 0),
    revenue: Number(r.revenue ?? 0),
    cash: Number(r.cash ?? 0),
    instapay: Number(r.instapay ?? 0),
    reservations: Number(r.reservations ?? 0),
  }));

  return {
    month,
    totalRevenue: events.reduce((sum, e) => sum + e.revenue, 0),
    totalAttendees: events.reduce((sum, e) => sum + e.attendees, 0),
    byMethod: {
      cash: events.reduce((sum, e) => sum + e.cash, 0),
      instapay: events.reduce((sum, e) => sum + e.instapay, 0),
    },
    events,
  };
}

/** Counts for the admin overview tiles. */
export async function getAdminOverview() {
  await connectDB();
  const now = new Date();
  const [upcoming, drafts, pendingSubmissions, totalReservations] = await Promise.all([
    Event.countDocuments({ status: "published", startsAt: { $gte: now } }),
    Event.countDocuments({ status: "draft" }),
    BandSubmission.countDocuments({ status: "pending" }),
    Reservation.countDocuments({ status: "confirmed" }),
  ]);
  return { upcoming, drafts, pendingSubmissions, totalReservations };
}

/**
 * A door row with the night it belongs to attached — the shape the cross-event
 * Customers grid needs (`PLAN/FIX_ADMIN_DASH.md` §2c).
 */
export type CheckInRowDTO = CheckInDTO & {
  eventTitleAr: string;
  eventTitleEn: string;
  eventStartsAt: string;
};

/**
 * Every check-in across every event, newest first.
 *
 * One `$lookup` rather than a query per row: the whole point of this screen is
 * to show who came *and* which night they came to, and doing that in a loop
 * would be the N+1 the developer guide §4.3 rules out.
 *
 * `limit` is a deliberate cap, not pagination — at cafe scale a few hundred
 * rows is the whole history, and the same "keep it simple until the scale
 * assumption changes" tradeoff the capacity check already makes applies here.
 */
export async function getAllCheckIns({
  eventId,
  q,
  limit = 500,
}: { eventId?: string; q?: string; limit?: number } = {}): Promise<CheckInRowDTO[]> {
  await connectDB();

  const match: Record<string, unknown> = {};
  if (eventId && mongoose.Types.ObjectId.isValid(eventId)) {
    match.event = new mongoose.Types.ObjectId(eventId);
  }
  if (q?.trim()) {
    // Escaped before it reaches the regex: an admin typing "(" into the search
    // box should find nothing, not crash the query.
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    match.$or = [{ name: rx }, { phone: rx }];
  }

  const rows = await CheckIn.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: Event.collection.name,
        localField: "event",
        foreignField: "_id",
        as: "eventDoc",
      },
    },
    { $unwind: { path: "$eventDoc", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        name: 1,
        phone: 1,
        paymentMethod: 1,
        amount: 1,
        note: 1,
        createdAt: 1,
        event: 1,
        reservation: 1,
        eventTitleAr: "$eventDoc.titleAr",
        eventTitleEn: "$eventDoc.titleEn",
        eventStartsAt: "$eventDoc.startsAt",
      },
    },
  ]);

  return rows.map((r) => ({
    id: String(r._id),
    eventId: String(r.event),
    name: r.name ?? "",
    phone: r.phone ?? "",
    paymentMethod: r.paymentMethod,
    amount: Number(r.amount ?? 0),
    reservationId: r.reservation ? String(r.reservation) : null,
    createdAt: new Date(r.createdAt).toISOString(),
    note: r.note ?? "",
    eventTitleAr: r.eventTitleAr ?? "",
    eventTitleEn: r.eventTitleEn ?? "",
    // An event deleted out from under its check-ins leaves the row orphaned
    // rather than hiding it — the money it recorded still happened.
    eventStartsAt: r.eventStartsAt ? new Date(r.eventStartsAt).toISOString() : "",
  }));
}

/** A reservation with its event attached, for the combined Reservations tab. */
export type ReservationRowDTO = ReservationDTO & {
  eventTitleAr: string;
  eventTitleEn: string;
  eventStartsAt: string;
  checkedIn: boolean;
};

/**
 * Every confirmed reservation across every event, soonest event first
 * (`PLAN/FIX_ADMIN_DASH.md` §3).
 *
 * Same shape of join as `getEventReservations`, widened from one event to all
 * of them: one `$lookup` for the event, a second for the check-in that may
 * have consumed the reservation, so "did they actually turn up" comes back in
 * the same pass rather than a second query per row.
 */
export async function getAllReservations({
  limit = 500,
}: { limit?: number } = {}): Promise<ReservationRowDTO[]> {
  await connectDB();

  const rows = await Reservation.aggregate([
    { $match: { status: "confirmed" } },
    {
      $lookup: {
        from: Event.collection.name,
        localField: "event",
        foreignField: "_id",
        as: "eventDoc",
      },
    },
    { $unwind: { path: "$eventDoc", preserveNullAndEmptyArrays: true } },
    { $sort: { "eventDoc.startsAt": -1, createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: CheckIn.collection.name,
        localField: "_id",
        foreignField: "reservation",
        as: "checkInDoc",
      },
    },
    {
      $project: {
        name: 1,
        phone: 1,
        code: 1,
        status: 1,
        createdAt: 1,
        event: 1,
        user: 1,
        eventTitleAr: "$eventDoc.titleAr",
        eventTitleEn: "$eventDoc.titleEn",
        eventStartsAt: "$eventDoc.startsAt",
        checkedIn: { $gt: [{ $size: "$checkInDoc" }, 0] },
      },
    },
  ]);

  return rows.map((r) => ({
    id: String(r._id),
    eventId: String(r.event),
    userId: String(r.user),
    name: r.name ?? "",
    phone: r.phone ?? "",
    code: r.code ?? "",
    status: r.status ?? "confirmed",
    createdAt: new Date(r.createdAt).toISOString(),
    checkedIn: Boolean(r.checkedIn),
    eventTitleAr: r.eventTitleAr ?? "",
    eventTitleEn: r.eventTitleEn ?? "",
    eventStartsAt: r.eventStartsAt ? new Date(r.eventStartsAt).toISOString() : "",
  }));
}

export type AccountDTO = {
  id: string;
  name: string;
  email: string;
  phone: string;
  image: string;
  providers: string[];
  /** Whether the account already has a password — drives §4b/§5b item 4's
   * set-vs-change branch on `/account`. The hash itself never leaves this
   * function. */
  hasPassword: boolean;
};

/**
 * The signed-in member's own account, shaped for `/account`
 * (`PLAN/LOG_SIGN_AUTH_IN.md` §5b). `passwordHash` is `select: false` on the
 * model, so it is pulled in explicitly here only to derive `hasPassword` —
 * it is never included in the returned DTO.
 */
export async function getAccountUser(userId: string): Promise<AccountDTO | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  await connectDB();
  const doc = await User.findById(userId).select("+passwordHash").lean();
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? "",
    image: doc.image ?? "",
    providers: doc.providers ?? [],
    hasPassword: Boolean(doc.passwordHash),
  };
}
