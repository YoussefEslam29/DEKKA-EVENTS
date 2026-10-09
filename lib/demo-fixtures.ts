/**
 * Demo mode's sample data (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.3). Pure, nothing stored:
 * built fresh per request, relative to "now", so there is always a night *tonight* in
 * Cairo for the banner, and the dates never go stale.
 */
import type { EventDTO, MenuCategoryDTO, MenuItemDTO, ReservationDTO, UsageStats } from "@/lib/data";
import { dayKey, fromLocalInputValue } from "@/lib/format";
import { cafeNightBounds, hasEnded } from "@/lib/staff";

const DAY = 86_400_000;

function at(day: string, hhmm: string): Date {
  return fromLocalInputValue(`${day}T${hhmm}`) ?? new Date();
}
const plusDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function event(now: Date, fields: Partial<EventDTO> & Pick<EventDTO, "id" | "titleAr" | "titleEn" | "startsAt">): EventDTO {
  return {
    descriptionAr: "",
    descriptionEn: "",
    locationAr: "",
    locationEn: "",
    mapUrl: "",
    coverImage: "",
    isPoster: false,
    doorsOpenAt: null,
    price: 150,
    capacity: 40,
    paymentMethods: ["cash", "instapay"],
    instapayNumber: "",
    termsAr: "",
    termsEn: "",
    status: "published",
    isPast: new Date(fields.startsAt).getTime() <= now.getTime(),
    ...fields,
  };
}

/** Tonight's night: 20:30 Cairo, or under way for the last hour if that has already ended. */
function tonightStart(now: Date): Date {
  const { key } = cafeNightBounds(now);
  const evening = at(key, "20:30");
  return hasEnded(evening, now) ? new Date(now.getTime() - 60 * 60_000) : evening;
}

export function demoEvents(now = new Date()): { upcoming: EventDTO[]; past: EventDTO[]; tonight: EventDTO[] } {
  const today = cafeNightBounds(now).key;
  const tonight = event(now, {
    id: "demo-tonight",
    titleAr: "ليلة عود وحكايات",
    titleEn: "Oud & Stories Night",
    descriptionAr: "عود حي، وحكايات من إسكندرية القديمة، وقهوة على مزاجك.",
    descriptionEn: "Live oud, stories from old Alexandria, and coffee the way you like it.",
    startsAt: tonightStart(now).toISOString(),
  });
  const upcoming = [
    tonight,
    event(now, {
      id: "demo-karaoke",
      titleAr: "ليلة كاريوكي مع Dekka Band",
      titleEn: "Karaoke Night with Dekka Band",
      descriptionAr: "اختار أغنيتك والفرقة وراك.",
      descriptionEn: "Pick your song; the band has your back.",
      startsAt: at(plusDays(today, 3), "21:00").toISOString(),
      price: 100,
    }),
    event(now, {
      id: "demo-openmic",
      titleAr: "أوبن مايك",
      titleEn: "Open Mic Night",
      descriptionAr: "شعر، ستاند أب، غُنا — المسرح ليك.",
      descriptionEn: "Poetry, stand-up, songs — the stage is yours.",
      startsAt: at(plusDays(today, 7), "20:00").toISOString(),
      price: 0,
      capacity: null,
    }),
    event(now, {
      id: "demo-jazz",
      titleAr: "جاز على البحر",
      titleEn: "Jazz by the Sea",
      startsAt: at(plusDays(today, 12), "20:30").toISOString(),
      price: 200,
      capacity: 30,
    }),
  ];
  const past = [
    event(now, { id: "demo-past-1", titleAr: "ليلة طرب", titleEn: "Tarab Night", startsAt: at(plusDays(today, -6), "20:30").toISOString(), status: "happened" }),
    event(now, { id: "demo-past-2", titleAr: "أوبن مايك", titleEn: "Open Mic Night", startsAt: at(plusDays(today, -13), "20:00").toISOString(), status: "happened", price: 0 }),
  ];
  return { upcoming, past, tonight: [tonight] };
}

/** Spots taken per sample night, for the "spots left" badges. */
export const DEMO_RESERVED: Record<string, number> = {
  "demo-tonight": 34,
  "demo-karaoke": 21,
  "demo-openmic": 12,
  "demo-jazz": 30,
};

/** The door codes the sample reservations show (the real alphabet, no 0/O or 1/I). */
export const DEMO_CODES: Record<string, string> = { "demo-tonight": "K7DQ4M", "demo-karaoke": "HX3PRN" };

export function demoReservations(now = new Date()): { reservation: ReservationDTO; event: EventDTO }[] {
  const { upcoming } = demoEvents(now);
  return upcoming
    .filter((e) => DEMO_CODES[e.id])
    .map((e) => ({
      event: e,
      reservation: {
        id: `demo-res-${e.id}`,
        eventId: e.id,
        userId: "demo",
        name: "Demo Guest",
        phone: "",
        code: DEMO_CODES[e.id],
        status: "confirmed" as const,
        createdAt: new Date(now.getTime() - 2 * DAY).toISOString(),
      },
    }));
}

function item(id: string, categoryId: string, order: number, fields: Partial<MenuItemDTO> & Pick<MenuItemDTO, "nameAr" | "nameEn" | "price">): MenuItemDTO {
  return {
    id: `demo-item-${id}`,
    categoryId,
    descriptionAr: "",
    descriptionEn: "",
    variants: [],
    image: "",
    tags: [],
    isFeatured: false,
    available: true,
    order,
    ...fields,
  };
}

export function demoMenu(now = new Date()): MenuCategoryDTO[] {
  const today = dayKey(now);
  const section = (id: string, order: number, nameAr: string, nameEn: string, items: MenuItemDTO[], season?: { startsOn: string; endsOn: string }) => ({
    id: `demo-cat-${id}`,
    nameAr,
    nameEn,
    order,
    isActive: true,
    startsOn: season?.startsOn ?? null,
    endsOn: season?.endsOn ?? null,
    items,
  });
  return [
    section("hot", 0, "مشروبات سخنة", "Hot drinks", [
      item("espresso", "demo-cat-hot", 0, { nameAr: "إسبريسو", nameEn: "Espresso", price: 45, tags: ["hot"], isFeatured: true }),
      item("latte", "demo-cat-hot", 1, {
        nameAr: "لاتيه",
        nameEn: "Latte",
        descriptionAr: "إسبريسو ولبن مبخّر ورغوة خفيفة.",
        descriptionEn: "Espresso, steamed milk, a thin layer of foam.",
        price: 60,
        variants: [
          { labelAr: "صغير", labelEn: "Small", price: 60 },
          { labelAr: "كبير", labelEn: "Large", price: 75 },
        ],
        tags: ["hot", "vegetarian"],
        isFeatured: true,
      }),
      item("turkish", "demo-cat-hot", 2, { nameAr: "قهوة تركي", nameEn: "Turkish coffee", price: 40, tags: ["hot"] }),
    ]),
    section("cold", 1, "مشروبات ساقعة", "Cold drinks", [
      item("iced-latte", "demo-cat-cold", 0, { nameAr: "آيس لاتيه", nameEn: "Iced latte", price: 70, tags: ["cold"] }),
      item("mint", "demo-cat-cold", 1, { nameAr: "ليمون نعناع", nameEn: "Lemon mint", price: 50, tags: ["cold", "vegan", "caffeineFree"], isFeatured: true }),
    ]),
    section("sweets", 2, "حلو", "Sweets", [
      item("basbousa", "demo-cat-sweets", 0, { nameAr: "بسبوسة", nameEn: "Basbousa", price: 45, available: false }),
      item("cheesecake", "demo-cat-sweets", 1, { nameAr: "تشيز كيك", nameEn: "Cheesecake", price: 85, isFeatured: true }),
    ]),
    section(
      "winter",
      3,
      "شتوي",
      "Winter specials",
      [item("sahlab", "demo-cat-winter", 0, { nameAr: "سحلب بالمكسرات", nameEn: "Sahlab with nuts", price: 65, tags: ["hot", "vegetarian"] })],
      { startsOn: plusDays(today, -10), endsOn: plusDays(today, 20) }
    ),
  ];
}

export function demoFeatured(now = new Date()): MenuItemDTO[] {
  return demoMenu(now).flatMap((c) => c.items.filter((i) => i.isFeatured && i.available));
}

export function demoStats(): UsageStats {
  return {
    topItems: [
      { id: "demo-item-latte", nameAr: "لاتيه", nameEn: "Latte", views: 412 },
      { id: "demo-item-espresso", nameAr: "إسبريسو", nameEn: "Espresso", views: 365 },
      { id: "demo-item-cheesecake", nameAr: "تشيز كيك", nameEn: "Cheesecake", views: 251 },
      { id: "demo-item-mint", nameAr: "ليمون نعناع", nameEn: "Lemon mint", views: 198 },
      { id: "demo-item-sahlab", nameAr: "سحلب بالمكسرات", nameEn: "Sahlab with nuts", views: 143 },
    ],
    promptShown: 486,
    promptAccepted: 61,
    appOpens: 233,
    qrScans: 97,
  };
}

/** One sample night by its `demo-*` id, upcoming or past. */
export function demoEventById(id: string, now = new Date()): EventDTO | null {
  const { upcoming, past } = demoEvents(now);
  return [...upcoming, ...past].find((e) => e.id === id) ?? null;
}
