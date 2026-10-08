/**
 * Arabic for share-card images (`PLAN/DEKKA_PWA_APP.md` §5.2, 4a.3). Pure.
 *
 * `next/og`'s renderer (Satori 0.25) has two gaps with Arabic:
 * - no bidi: it lays a line out left to right, so a title reads backwards;
 * - it *measures* text letter by letter, in the wide unjoined forms, but *draws* it shaped
 *   (joined, narrower), so every Arabic word gets a box wider than its ink: uneven gaps,
 *   and lines that wrap far too early.
 *
 * So the card never hands it a plain Arabic letter. Each word is shaped here, into the
 * Unicode presentation forms (U+FB50–U+FEFF: one code point per joined shape), and the
 * line is written in *visual* order, left to right as it must appear. The renderer treats
 * presentation forms as plain glyphs: it neither reshapes nor reorders them, and measures
 * them exactly as it draws them. (Its own Arabic handling only matches U+0600–U+06FF.)
 * Cairo leaves the *isolated* forms out of its character map; `scripts/make-og-font.py`
 * maps them in the card's copy of the font.
 *
 * Digits and Latin keep their left-to-right order inside an Arabic line.
 */

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LETTER = /\p{L}/u;
// Harakat and tatweel: dropped. The renderer can't place a mark over a letter, and a lone
// tatweel is the one Arabic-range code point that would still reach it.
const DROPPED = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export type Run = { text: string; rtl: boolean };

/** A word's direction: Arabic letters → rtl, other letters → ltr, neither → neutral. */
function directionOf(word: string): "rtl" | "ltr" | "neutral" {
  if (ARABIC.test(word) && [...word].some((c) => LETTER.test(c))) return "rtl";
  if ([...word].some((c) => LETTER.test(c))) return "ltr";
  return "neutral";
}

/**
 * Splits a line into direction runs, in logical order. A Latin stretch ("Dekka Band",
 * "Open Mic 2") is one run; digits and punctuation ride with the word before them (or the
 * one after, at the start), so they never jump to the far end of the line.
 */
export function bidiRuns(line: string): Run[] {
  const words = line.trim().split(/\s+/).filter(Boolean);
  const runs: Run[] = [];
  let pending: string[] = []; // neutral words seen before any directional one

  for (const word of words) {
    const dir = directionOf(word);
    const last = runs[runs.length - 1];
    if (dir === "neutral") {
      if (last) last.text += ` ${word}`;
      else pending.push(word);
      continue;
    }
    const text = pending.length ? `${pending.join(" ")} ${word}` : word;
    pending = [];
    if (last && last.rtl === (dir === "rtl")) last.text += ` ${text}`;
    else runs.push({ text, rtl: dir === "rtl" });
  }
  if (pending.length) runs.push({ text: pending.join(" "), rtl: false });
  return runs;
}

// --- shaping ----------------------------------------------------------------------------

/** Presentation forms per letter: [isolated, final, initial, medial]; two = joins right only. */
const FORMS = new Map<number, number[]>();
{
  // U+FE80 onwards lists the basic letters in order, 1, 2 or 4 forms each.
  const order: [number, number][] = [
    [0x0621, 1], [0x0622, 2], [0x0623, 2], [0x0624, 2], [0x0625, 2], [0x0626, 4], [0x0627, 2],
    [0x0628, 4], [0x0629, 2], [0x062a, 4], [0x062b, 4], [0x062c, 4], [0x062d, 4], [0x062e, 4],
    [0x062f, 2], [0x0630, 2], [0x0631, 2], [0x0632, 2], [0x0633, 4], [0x0634, 4], [0x0635, 4],
    [0x0636, 4], [0x0637, 4], [0x0638, 4], [0x0639, 4], [0x063a, 4], [0x0641, 4], [0x0642, 4],
    [0x0643, 4], [0x0644, 4], [0x0645, 4], [0x0646, 4], [0x0647, 4], [0x0648, 2], [0x0649, 2],
    [0x064a, 4],
  ];
  let next = 0xfe80;
  for (const [letter, count] of order) {
    FORMS.set(letter, Array.from({ length: count }, (_, i) => next + i));
    next += count;
  }
  // Alef maksura joins both ways; its initial and medial forms live in block A.
  FORMS.set(0x0649, [0xfeef, 0xfef0, 0xfbe8, 0xfbe9]);
  // Letters used for foreign sounds (Egyptian Arabic writes "V" as ڤ, "G" as گ).
  FORMS.set(0x067e, [0xfb56, 0xfb57, 0xfb58, 0xfb59]); // پ
  FORMS.set(0x0686, [0xfb7a, 0xfb7b, 0xfb7c, 0xfb7d]); // چ
  FORMS.set(0x0698, [0xfb8a, 0xfb8b]); // ژ
  FORMS.set(0x06a4, [0xfb6a, 0xfb6b, 0xfb6c, 0xfb6d]); // ڤ
  FORMS.set(0x06a9, [0xfb8e, 0xfb8f, 0xfb90, 0xfb91]); // ک
  FORMS.set(0x06af, [0xfb92, 0xfb93, 0xfb94, 0xfb95]); // گ
  FORMS.set(0x06cc, [0xfbfc, 0xfbfd, 0xfbfe, 0xfbff]); // ی
}

/** Lam followed by an alef is one ligature: [isolated, final]. */
const LAM_ALEF = new Map<number, number[]>([
  [0x0622, [0xfef5, 0xfef6]],
  [0x0623, [0xfef7, 0xfef8]],
  [0x0625, [0xfef9, 0xfefa]],
  [0x0627, [0xfefb, 0xfefc]],
]);
const LAM = 0x0644;

type Shape = { forms: number[] | null; code: number };

const joinsBoth = (s: Shape | undefined) => Boolean(s?.forms && s.forms.length === 4);
const joins = (s: Shape | undefined) => Boolean(s?.forms && s.forms.length >= 2);

/** One word, logical order in, logical order out, every Arabic letter in its joined form. */
export function shapeArabic(word: string): string {
  const codes = [...word.replace(DROPPED, "")].map((c) => c.codePointAt(0)!);
  const shapes: Shape[] = [];
  for (let i = 0; i < codes.length; i++) {
    const ligature = codes[i] === LAM ? LAM_ALEF.get(codes[i + 1]) : undefined;
    if (ligature) {
      shapes.push({ forms: ligature, code: codes[i] });
      i++;
    } else {
      shapes.push({ forms: FORMS.get(codes[i]) ?? null, code: codes[i] });
    }
  }
  return shapes
    .map((shape, i) => {
      if (!shape.forms) return String.fromCodePoint(shape.code);
      const fromRight = joinsBoth(shapes[i - 1]) && joins(shape);
      const toLeft = shape.forms.length === 4 && joins(shapes[i + 1]);
      const index = fromRight ? (toLeft ? 3 : 1) : toLeft ? 2 : 0;
      return String.fromCodePoint(shape.forms[index] ?? shape.forms[0]);
    })
    .join("");
}

// --- visual order -----------------------------------------------------------------------

/** A stretch that reads left to right even inside Arabic: a number (with its separators) or Latin. */
const LTR_STRETCH = /([0-9\u0660-\u0669\u06F0-\u06F9]+(?:[.,:/\u066B\u066C][0-9\u0660-\u0669\u06F0-\u06F9]+)*|[A-Za-z][A-Za-z0-9'’.&-]*)/;
const MIRROR: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "«": "»", "»": "«", "<": ">", ">": "<" };

/** One word of an Arabic run, shaped and in visual (left-to-right) order. */
function visualWord(word: string): string {
  return shapeArabic(word)
    .split(LTR_STRETCH)
    .filter(Boolean)
    .reverse()
    .map((part) => (LTR_STRETCH.test(part) ? part : [...part].reverse().map((c) => MIRROR[c] ?? c).join("")))
    .join("");
}

/**
 * One line of an Arabic-first layout, ready for a renderer that only lays out left to
 * right: shaped, the runs in reverse, the words of each Arabic run in reverse, each Arabic
 * word's letters in reverse. A Latin run keeps its own order.
 */
export function toVisual(line: string): string {
  return bidiRuns(line)
    .reverse()
    .map((run) => (run.rtl ? run.text.split(" ").reverse().map(visualWord).join(" ") : run.text))
    .join(" ");
}

/**
 * Wraps text into at most `maxLines` lines of about `maxChars` characters, in *logical*
 * order, breaking at spaces, and returns each line in visual order. Wrapping happens
 * before reordering, so the first line holds the first words, as an Arabic reader expects.
 * Too long: the last line ends with an ellipsis, as its own token so it lands on the
 * reading end (the left).
 */
export function visualLines(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[][] = [[]];
  let length = 0;
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (current.length > 0 && length + 1 + word.length > maxChars) {
      lines.push([word]);
      length = word.length;
    } else {
      current.push(word);
      length += (current.length > 1 ? 1 : 0) + word.length;
    }
  }
  const kept = lines.slice(0, maxLines);
  if (lines.length > maxLines) kept[maxLines - 1].push("…");
  return kept.map((l) => toVisual(l.join(" ")));
}

/** Cuts a Latin title to about one line at the card's size, at a word, with an ellipsis. */
export function clampTitle(title: string, maxChars: number): string {
  const clean = title.trim().replace(/\s+/g, " ");
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const space = cut.lastIndexOf(" ");
  return `${(space > maxChars * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}
