/**
 * CSV for the admin's exports (`PLAN/SITE_ROADMAP.md` F5): RFC 4180, the way Excel opens
 * it. Pure.
 * - **UTF-8 with a byte-order mark:** without it Excel guesses a legacy code page and
 *   Arabic names come out garbled.
 * - **CRLF line ends, quotes doubled.**
 * - **Formula injection:** guest-typed text (names, notes) reaches these files, and Excel
 *   runs a cell starting with `=`, `+`, `-` or `@` as a formula. Such text gets a leading
 *   apostrophe, which Excel shows as plain text. Numbers are left alone.
 */

const BOM = String.fromCharCode(0xfeff);
const FORMULA_START = /^[=+\-@\t\r]/;

export type CsvCell = string | number | null | undefined;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return `${BOM}${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/** The response headers for a CSV download named `filename`. */
export function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
}
