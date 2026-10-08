// The share card for one night (`PLAN/DEKKA_PWA_APP.md` §5.2, 4a.3): the 1200×630 PNG that
// WhatsApp, Facebook and others show under a pasted link. Server-only.
//
// Bilingual on purpose: a crawler carries no language cookie. No poster photo inside: a
// photo would push the PNG far past the ~300 KB WhatsApp is known to accept.
import { readFileSync } from "node:fs";
import { ImageResponse } from "next/og";
import { clampTitle, toVisual, visualLines } from "@/lib/og/bidi";
import { CAFE_TIMEZONE, formatMoney } from "@/lib/format";

// A static Cairo Bold (lib/og/fonts, cut by scripts/make-og-font.py from the vendored
// variable font: Satori can't parse a variable one). Read the same way the PDF report reads
// its font, so Vercel's file tracing ships the file with the route.
const cairo = readFileSync(new URL("./fonts/Cairo-Bold.ttf", import.meta.url));
const logo = `data:image/png;base64,${readFileSync(
  new URL("../../public/brand/dekka-logo-square.png", import.meta.url)
).toString("base64")}`;

export const CARD_SIZE = { width: 1200, height: 630 } as const;

const INK = "#18120d";
const CREAM = "#f3e6d8";
const GOLD = "#d9a566";
const ON_DARK = "#f5f0ea";
const MUTED = "#9c9086";

export type CardInput = {
  titleAr: string;
  titleEn: string;
  startsAt: string | Date;
  price: number;
  host: string;
};

function part(date: Date, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { timeZone: CAFE_TIMEZONE, ...options }).format(date);
}

/** Arabic-first lines, already in visual order (lib/og/bidi.ts), right-aligned. */
function RtlLines({ lines, size, color }: { lines: string[]; size: number; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: size, color, lineHeight: 1.3 }}>
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  );
}

export function renderEventCard(input: CardInput): ImageResponse {
  const date = new Date(input.startsAt);
  // Built from parts, not one formatted string, so digits can't change places.
  const arDate = [
    part(date, "ar-EG", { weekday: "long" }),
    `${part(date, "ar-EG", { day: "numeric" })} ${part(date, "ar-EG", { month: "long" })}`,
    "·",
    part(date, "ar-EG", { hour: "numeric", minute: "2-digit", hour12: true }),
  ].join(" ");
  const enDate = `${part(date, "en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${part(date, "en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase()}`;
  // One chip, both languages, read from the right: "١٥٠ ج.م · EGP 150".
  const price = toVisual(input.price > 0 ? `${formatMoney(input.price, "ar")} ج.م · EGP ${input.price}` : "مجاناً · Free");
  const titleLines = visualLines(input.titleAr || input.titleEn, 28, 2);
  // The English line under it, unless the big line already is the English title.
  const titleEn =
    input.titleAr && input.titleEn && input.titleEn !== input.titleAr ? clampTitle(input.titleEn, 60) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          borderTop: `10px solid ${GOLD}`,
          padding: "48px 64px 40px",
          fontFamily: "Cairo",
        }}
      >
        <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", background: CREAM, borderRadius: 28, padding: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- drawn by Satori into a PNG, not a page */}
            <img src={logo} width={104} height={104} alt="" />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row-reverse",
              alignItems: "center",
              background: GOLD,
              color: INK,
              borderRadius: 999,
              padding: "8px 28px",
              fontSize: 30,
            }}
          >
            <span>{price}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <RtlLines lines={titleLines} size={68} color={ON_DARK} />
          {titleEn ? (
            <div style={{ display: "flex", alignSelf: "flex-start", fontSize: 40, color: MUTED, marginTop: 10 }}>{titleEn}</div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <RtlLines lines={[toVisual(arDate)]} size={34} color={GOLD} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <span style={{ fontSize: 24, color: MUTED }}>{input.host}</span>
            <span style={{ fontSize: 30, color: GOLD }}>{enDate}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts: [{ name: "Cairo", data: cairo, style: "normal", weight: 700 }],
    }
  );
}
