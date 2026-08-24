/**
 * Seeds a working Dekka instance: an admin, a staff member, two members, three
 * events across the lifecycle, reservations, a door table and a couple of band
 * pitches. Safe to re-run — it clears the collections it owns first.
 *
 *   npm run seed
 */
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Event } from "../models/Event";
import { Reservation, generateReservationCode } from "../models/Reservation";
import { CheckIn } from "../models/CheckIn";
import { BandSubmission } from "../models/BandSubmission";

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * `main()` drops every collection it owns before reseeding — exactly what you
 * want against a scratch database, and a catastrophe against a real one. So
 * anything that isn't plain loopback is refused unless the caller says so out
 * loud: a stray production `MONGODB_URI` left in the environment shouldn't be
 * able to cost the cafe its events.
 */
function assertSafeTarget(uri: string): void {
  const host = uri
    .replace(/^mongodb(\+srv)?:\/\//, "")
    .replace(/^[^@]*@/, "")
    .split(/[/?,]/)[0]
    .replace(/:\d+$/, "");
  const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
  // `mongodb+srv://` only ever resolves to a hosted cluster, never to loopback.
  const isRemote = uri.startsWith("mongodb+srv://") || !isLoopback;

  if (!isRemote) return;

  if (process.env.SEED_ALLOW_REMOTE !== "yes") {
    throw new Error(
      `Refusing to seed "${host}": seeding drops every collection first. ` +
        `Local development should point MONGODB_URI at 127.0.0.1 (see docker-compose.yml). ` +
        `If you really do mean to wipe and reseed this database, ` +
        `re-run with SEED_ALLOW_REMOTE=yes.`
    );
  }
  console.warn(`WARNING: seeding remote host "${host}" — every collection will be dropped.`);
}

function at(dayOffset: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set — copy .env.example to .env.local first.");
  }

  assertSafeTarget(MONGODB_URI);

  await mongoose.connect(MONGODB_URI);
  console.log("connected");

  await Promise.all([
    User.deleteMany({}),
    Event.deleteMany({}),
    Reservation.deleteMany({}),
    CheckIn.deleteMany({}),
    BandSubmission.deleteMany({}),
  ]);

  const password = await bcrypt.hash("dekka1234", 12);

  const [, staff, member1, member2] = await User.create([
    {
      name: "Dekka Admin",
      email: "admin@dekka.test",
      phone: "01000000001",
      passwordHash: password,
      role: "admin",
    },
    {
      name: "Dekka Staff",
      email: "staff@dekka.test",
      phone: "01000000002",
      passwordHash: password,
      role: "staff",
    },
    {
      name: "سارة محمود",
      email: "sara@example.test",
      phone: "01111111111",
      passwordHash: password,
      role: "member",
    },
    {
      name: "Omar Adel",
      email: "omar@example.test",
      phone: "01222222222",
      passwordHash: password,
      role: "member",
    },
  ]);

  const [upcoming, soon, past] = await Event.create([
    {
      titleAr: "ليلة الباند — الخميس",
      titleEn: "Band Night — Thursday",
      descriptionAr:
        "ليلة موسيقى حيّة مع ضيوف من السين المستقل. الأبواب بتفتح بدري، والقعدة على الدكة.",
      descriptionEn:
        "A live set with guests from the independent scene. Doors open early; seating is first come, first served.",
      locationAr: "دكة كافيه، القاهرة",
      locationEn: "Dekka Cafe, Cairo",
      startsAt: at(5, 20),
      doorsOpenAt: at(5, 19),
      price: 150,
      capacity: 40,
      paymentMethods: ["cash", "instapay"],
      instapayNumber: "01000000001",
      termsAr: "الحجز بيثبّت مكانك لحد 15 دقيقة بعد بداية العرض.",
      termsEn: "Your reservation holds your spot until 15 minutes after the set starts.",
      status: "published",
    },
    {
      titleAr: "مايك مفتوح",
      titleEn: "Open Mic",
      descriptionAr: "الميكروفون مفتوح لأي حد عايز يقول حاجة أو يعزف حاجة.",
      descriptionEn: "The mic is open — bring a song, a poem, or whatever you have.",
      locationAr: "دكة كافيه، القاهرة",
      locationEn: "Dekka Cafe, Cairo",
      startsAt: at(12, 21),
      price: 0,
      capacity: null,
      paymentMethods: ["cash"],
      status: "published",
    },
    {
      titleAr: "حفلة الشتا",
      titleEn: "Winter Session",
      descriptionAr: "حفلة صغيرة بتشكيلة أكوستيك.",
      descriptionEn: "A small acoustic session.",
      locationAr: "دكة كافيه، القاهرة",
      locationEn: "Dekka Cafe, Cairo",
      startsAt: at(-9, 20),
      price: 120,
      capacity: 35,
      paymentMethods: ["cash", "instapay"],
      instapayNumber: "01000000001",
      status: "happened",
    },
  ]);

  await Reservation.create([
    {
      event: upcoming._id,
      user: member1._id,
      name: member1.name,
      phone: member1.phone,
      code: generateReservationCode(),
    },
    {
      event: upcoming._id,
      user: member2._id,
      name: member2.name,
      phone: member2.phone,
      code: generateReservationCode(),
    },
    {
      event: soon._id,
      user: member1._id,
      name: member1.name,
      phone: member1.phone,
      code: generateReservationCode(),
    },
  ]);

  // A finished night, so the monthly report has something real in it.
  await CheckIn.create([
    {
      event: past._id,
      name: "سارة محمود",
      phone: "01111111111",
      paymentMethod: "cash",
      amount: 120,
      recordedBy: staff._id,
    },
    {
      event: past._id,
      name: "Omar Adel",
      phone: "01222222222",
      paymentMethod: "instapay",
      amount: 120,
      recordedBy: staff._id,
    },
    {
      event: past._id,
      name: "Nadia H.",
      phone: "01033333333",
      paymentMethod: "cash",
      amount: 120,
      recordedBy: staff._id,
    },
  ]);

  await BandSubmission.create([
    {
      bandName: "El Sath",
      genre: "Indie / Arabic rock",
      contactName: "Youssef",
      email: "band@example.test",
      phone: "01055555555",
      links: ["https://soundcloud.com/example", "https://instagram.com/example"],
      preferredDates: "أي خميس في الشهر الجاي",
      pitch: "تلات أفراد، سِت أكوستيك حوالي 45 دقيقة.",
      status: "pending",
    },
    {
      bandName: "Cairo Tape Club",
      genre: "Lo-fi",
      contactName: "Mariam",
      email: "tape@example.test",
      links: ["https://youtube.com/@example"],
      preferredDates: "Weekends",
      pitch: "A short DJ-and-tape-deck set, roughly an hour.",
      status: "approved",
    },
  ]);

  console.log("seeded:");
  console.log("  admin  admin@dekka.test / dekka1234");
  console.log("  staff  staff@dekka.test / dekka1234");
  console.log("  member sara@example.test / dekka1234");
  console.log(`  ${await Event.countDocuments()} events, ${await Reservation.countDocuments()} reservations`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
