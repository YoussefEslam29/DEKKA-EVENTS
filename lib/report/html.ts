import { readFileSync } from "node:fs";
import type { Locale } from "@/lib/i18n";
import type { ReportView, Cell } from "@/lib/report/view";

/**
 * Cairo covers Arabic and Latin and is already the app's Arabic face
 * (`app/layout.tsx`). It is embedded as a data URI rather than linked so the
 * PDF renders identically offline and on a serverless Chromium whose system
 * font set has little or no Arabic coverage — without this, Arabic guest
 * names in the door data come out as tofu. Read once at module load via a
 * `new URL(..., import.meta.url)` path so Next's file tracer bundles the
 * font with the route.
 */
const CAIRO_DATA_URI = (() => {
  const buf = readFileSync(new URL("./fonts/Cairo.ttf", import.meta.url));
  return `data:font/ttf;base64,${buf.toString("base64")}`;
})();

/** Data colours — one per series, reused across every chart. */
const C = {
  gold: "#b98f3e",
  good: "#4f8f68",
  warm: "#c06b4f",
  brown: "#7a6142",
  line: "#e7dcc9",
  ink: "#23180f",
  muted: "#8a7960",
  faint: "#b6a88f",
};

const SEGMENT_COLOR: Record<string, string> = {
  cash: C.good,
  instapay: C.gold,
  attended: C.good,
  walkin: C.gold,
  noshow: C.warm,
  female: C.good,
  male: C.brown,
  gunknown: C.faint,
};

function esc(value: Cell): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- charts ---------- */

/** Vertical bar chart of arrivals per half-hour window, as inline SVG. */
function arrivalsChart(view: ReportView, rtl: boolean): string {
  const bars = view.charts.arrivals;
  if (bars.length === 0) {
    return `<p class="empty">${esc(view.charts.arrivalsEmpty)}</p>`;
  }

  const W = 660;
  const H = 128;
  const padX = 8;
  const baseY = 100;
  const topPad = 18;
  const labelY = 118;
  const max = Math.max(...bars.map((b) => b.count), 1);
  // Cap the per-bar slot so a night with only two windows shows two tidy
  // columns in the middle, not two lonely bars pinned to the page edges.
  const slot = Math.min((W - padX * 2) / bars.length, 84);
  const groupW = slot * bars.length;
  const originX = padX + ((W - padX * 2) - groupW) / 2;
  const barW = Math.min(44, slot * 0.62);
  const showEvery = bars.length > 16 ? 2 : 1;

  const parts = bars.map((b, i) => {
    const order = rtl ? bars.length - 1 - i : i;
    const cx = originX + slot * order + slot / 2;
    const h = (b.count / max) * (baseY - topPad);
    const y = baseY - h;
    const label =
      i % showEvery === 0
        ? `<text x="${cx.toFixed(1)}" y="${labelY}" class="c-axis" text-anchor="middle">${esc(
            b.window
          )}</text>`
        : "";
    return `
      <rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(
        1
      )}" height="${Math.max(h, 0.5).toFixed(1)}" rx="2" fill="${C.gold}" />
      <text x="${cx.toFixed(1)}" y="${(y - 5).toFixed(1)}" class="c-val" text-anchor="middle">${esc(
        b.countLabel
      )}</text>${label}`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" preserveAspectRatio="xMidYMid meet" role="img">
    <line x1="${padX}" y1="${baseY}" x2="${W - padX}" y2="${baseY}" stroke="${C.line}" stroke-width="1" />
    ${parts.join("")}
  </svg>`;
}

/** A single 100%-width stacked bar + a legend, from pre-built segments. */
function stackedBar(
  segments: { key: string; value: number; legend: string }[],
  emptyText: string,
  rtl: boolean
): string {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const ordered = rtl ? [...segments].reverse() : segments;

  const bar =
    total <= 0
      ? `<div class="bar bar-empty"></div>`
      : `<div class="bar">${ordered
          .filter((s) => s.value > 0)
          .map(
            (s) =>
              `<span style="flex-grow:${s.value};background:${
                SEGMENT_COLOR[s.key] ?? C.muted
              }"></span>`
          )
          .join("")}</div>`;

  const legend = segments
    .map(
      (s) =>
        `<span class="lg"><i style="background:${
          SEGMENT_COLOR[s.key] ?? C.muted
        }"></i>${esc(s.legend)}</span>`
    )
    .join("");

  return `${bar}<div class="legend">${legend}</div>${
    total <= 0 ? `<p class="empty">${esc(emptyText)}</p>` : ""
  }`;
}

/* ---------- blocks ---------- */

function statsBand(view: ReportView): string {
  return `<div class="stats">${view.stats
    .map(
      (s) =>
        `<div class="stat"><div class="stat-v">${esc(s.value)}</div><div class="stat-l">${esc(
          s.label
        )}</div></div>`
    )
    .join("")}</div>`;
}

function chartsBlock(view: ReportView, rtl: boolean): string {
  return `
    <section class="block">
      <h2>${esc(view.charts.arrivalsHeading)}</h2>
      ${arrivalsChart(view, rtl)}
    </section>
    <section class="block cols3">
      <div>
        <h2>${esc(view.charts.paymentHeading)}</h2>
        ${stackedBar(view.charts.payment, view.charts.paymentEmpty, rtl)}
      </div>
      <div>
        <h2>${esc(view.charts.attendanceHeading)}</h2>
        ${stackedBar(view.charts.attendance, view.charts.attendanceEmpty, rtl)}
      </div>
      <div>
        <h2>${esc(view.charts.genderHeading)}</h2>
        ${stackedBar(view.charts.gender, view.charts.genderEmpty, rtl)}
      </div>
    </section>`;
}

function detailsBlock(view: ReportView): string {
  return `
    <section class="block">
      <h2>${esc(view.detailsHeading)}</h2>
      <div class="details">
        ${view.summary
          .map(
            (section) => `
          <div class="det">
            <h3>${esc(section.heading)}</h3>
            ${section.items
              .map(
                (item) =>
                  `<div class="row"><span>${esc(item.label)}</span><span class="v">${esc(
                    item.value
                  )}</span></div>`
              )
              .join("")}
          </div>`
          )
          .join("")}
      </div>
    </section>`;
}

function peopleTable(view: ReportView): string {
  const numericCols = new Set([8]); // amount
  const ltrCols = new Set([1, 3]); // phone, code — keep digits/"+" unreordered in RTL
  const cellClass = (i: number) =>
    numericCols.has(i) ? "num" : ltrCols.has(i) ? "ltr" : "";
  const body =
    view.people.rows.length === 0
      ? `<tr><td colspan="${view.people.columns.length}" class="empty">${esc(
          view.people.empty
        )}</td></tr>`
      : view.people.rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell, i) => `<td class="${cellClass(i)}">${esc(cell)}</td>`)
                .join("")}</tr>`
          )
          .join("");
  return `
    <section class="block">
      <h2>${esc(view.people.heading)}</h2>
      <table class="people">
        <thead><tr>${view.people.columns
          .map((c, i) => `<th class="${numericCols.has(i) ? "num" : ""}">${esc(c)}</th>`)
          .join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

/** Full standalone HTML document for the report PDF. */
export function reportHtml(view: ReportView, locale: Locale): string {
  const rtl = locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: "Cairo";
    src: url("${CAIRO_DATA_URI}") format("truetype");
    font-weight: 200 1000;
    font-display: block;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Cairo", system-ui, sans-serif;
    color: ${C.ink};
    background: #fefdfb;
    font-size: 10.5px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  text { font-family: "Cairo", sans-serif; }
  .page { padding: 4px 2px 8px; }

  header.report { margin-bottom: 18px; }
  header.report h1 {
    font-size: 19px; font-weight: 750; margin: 0 0 3px; letter-spacing: -0.01em;
  }
  header.report .sub { font-size: 11px; color: ${C.muted}; }
  header.report .gen { font-size: 9px; color: ${C.faint}; margin-top: 3px; }
  header.report .rule { height: 2px; background: ${C.gold}; margin-top: 9px; width: 46px; }

  h2 {
    font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.14em;
    color: ${C.muted}; font-weight: 700; margin: 0 0 8px;
  }
  h3 {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em;
    color: ${C.muted}; font-weight: 700; margin: 0 0 5px;
  }
  .block { margin-bottom: 20px; break-inside: avoid; }
  .cols3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }

  /* headline figures */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .stat { background: #f7f2e8; border-radius: 6px; padding: 11px 12px; }
  .stat-v { font-size: 21px; font-weight: 750; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .stat-l {
    font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em;
    color: ${C.muted}; font-weight: 600; margin-top: 2px;
  }

  /* charts */
  .chart-svg { width: 100%; height: auto; overflow: visible; }
  .c-val { fill: ${C.ink}; font-size: 8.5px; font-weight: 700; }
  .c-axis { fill: ${C.muted}; font-size: 8px; }
  .bar {
    display: flex; height: 18px; border-radius: 5px; overflow: hidden;
    background: #efe7d6; margin-bottom: 7px;
  }
  .bar span { display: block; }
  .bar-empty { opacity: 0.5; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 9px; color: ${C.muted}; }
  .legend .lg { display: inline-flex; align-items: center; gap: 5px; }
  .legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; flex: none; }

  /* details */
  .details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
  .det .row {
    display: flex; justify-content: space-between; gap: 10px;
    padding: 3px 0; border-top: 1px solid ${C.line};
  }
  .det .row:first-of-type { border-top: 0; }
  .det .row span:first-child { color: ${C.muted}; }
  .det .row .v { font-weight: 700; font-variant-numeric: tabular-nums; text-align: ${end}; }

  /* people */
  table.people { border-collapse: collapse; width: 100%; font-size: 9.5px; }
  table.people th {
    text-align: ${start}; padding: 6px 7px; font-weight: 700; font-size: 8px;
    text-transform: uppercase; letter-spacing: 0.06em; color: ${C.muted};
    border-bottom: 1.5px solid ${C.ink};
  }
  table.people td { padding: 5px 7px; border-bottom: 1px solid ${C.line}; }
  table.people td:first-child { font-weight: 700; }
  thead { display: table-header-group; }
  .num { text-align: ${end}; font-variant-numeric: tabular-nums; }
  th.num { text-align: ${end}; }
  .ltr { direction: ltr; text-align: ${start}; unicode-bidi: isolate; }
  .empty { color: ${C.muted}; font-style: italic; font-size: 9.5px; margin: 4px 0 0; }
</style>
</head>
<body>
  <div class="page">
    <header class="report">
      <h1>${esc(view.title)}</h1>
      <div class="sub">${esc(view.subtitle)}</div>
      <div class="gen">${esc(view.generatedNote)}</div>
      <div class="rule"></div>
    </header>
    ${statsBand(view)}
    ${chartsBlock(view, rtl)}
    ${detailsBlock(view)}
    ${peopleTable(view)}
  </div>
</body>
</html>`;
}
