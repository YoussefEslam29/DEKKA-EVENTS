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

function esc(value: Cell): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function summaryTable(view: ReportView): string {
  return view.summary
    .map(
      (section) => `
      <section class="block">
        <h2>${esc(section.heading)}</h2>
        <table class="kv">
          <tbody>
            ${section.items
              .map(
                (item) =>
                  `<tr><th>${esc(item.label)}</th><td>${esc(item.value)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </section>`
    )
    .join("");
}

function timingTable(view: ReportView): string {
  const body =
    view.timing.rows.length === 0
      ? `<tr><td colspan="2" class="muted">${esc(view.timing.empty)}</td></tr>`
      : view.timing.rows
          .map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`)
          .join("");
  return `
    <section class="block">
      <h2>${esc(view.timing.heading)}</h2>
      <table class="grid">
        <thead><tr><th>${esc(view.timing.columns[0])}</th><th class="num">${esc(
          view.timing.columns[1]
        )}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

function peopleTable(view: ReportView): string {
  const numericCols = new Set([7]); // amount
  const ltrCols = new Set([1, 3]); // phone, code — keep digits/“+” unreordered in RTL
  const cellClass = (i: number) =>
    numericCols.has(i) ? "num" : ltrCols.has(i) ? "ltr" : "";
  const body =
    view.people.rows.length === 0
      ? `<tr><td colspan="${view.people.columns.length}" class="muted">${esc(
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
      <table class="grid people">
        <thead><tr>${view.people.columns
          .map((c, i) => `<th class="${numericCols.has(i) ? "num" : ""}">${esc(c)}</th>`)
          .join("")}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
}

/** Full standalone HTML document for the report PDF. */
export function reportHtml(view: ReportView, locale: Locale): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
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
    color: #2b1d12;
    background: #fdfaf4;
    font-size: 11px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { padding: 32px 36px; }
  header.report { border-bottom: 3px solid #c8a86b; padding-bottom: 12px; margin-bottom: 20px; }
  header.report h1 { font-size: 18px; margin: 0 0 4px; font-weight: 800; }
  header.report .subtitle { font-size: 12px; color: #6b5942; }
  header.report .generated { font-size: 10px; color: #99856a; margin-top: 4px; }
  .block { margin-bottom: 18px; break-inside: avoid; }
  h2 {
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;
    color: #8a6d3b; margin: 0 0 8px; font-weight: 700;
  }
  table { border-collapse: collapse; width: 100%; }
  table.kv th {
    text-align: ${dir === "rtl" ? "right" : "left"};
    width: 40%; font-weight: 600; color: #6b5942; padding: 3px 8px;
    vertical-align: top;
  }
  table.kv td { padding: 3px 8px; font-weight: 700; }
  table.grid { font-size: 10px; }
  table.grid th {
    background: #f1e7d3; text-align: ${dir === "rtl" ? "right" : "left"};
    padding: 6px 8px; font-weight: 700; border-bottom: 2px solid #c8a86b;
  }
  table.grid td { padding: 5px 8px; border-bottom: 1px solid #ece1cd; }
  table.grid tr:nth-child(even) td { background: #faf5ea; }
  thead { display: table-header-group; }
  .num { text-align: ${dir === "rtl" ? "left" : "right"}; font-variant-numeric: tabular-nums; }
  .ltr { direction: ltr; text-align: ${dir === "rtl" ? "right" : "left"}; unicode-bidi: isolate; }
  .muted { color: #99856a; font-style: italic; }
  .people td:first-child { font-weight: 700; }
</style>
</head>
<body>
  <div class="page">
    <header class="report">
      <h1>${esc(view.title)}</h1>
      <div class="subtitle">${esc(view.subtitle)}</div>
      <div class="generated">${esc(view.generatedNote)}</div>
    </header>
    ${summaryTable(view)}
    ${timingTable(view)}
    ${peopleTable(view)}
  </div>
</body>
</html>`;
}
