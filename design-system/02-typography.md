# Typography

## Font families

| Language | Font | Why |
|---|---|---|
| Arabic | **Cairo** | Closest in feel to the wordmark's bold angular calligraphy |
| Latin / English | **Plus Jakarta Sans** | Rounded, geometric sans — matches the bold rounded feel called for in the original mockups |

Both are loaded via `next/font/google` in `app/layout.tsx` and exposed as CSS variables
(`--font-cairo`, `--font-jakarta`), then mapped to `--font-arabic` / `--font-latin` in
`globals.css`. The root `<html dir>` decides which one `body` uses by default — but
anything explicitly tagged `lang="ar"` or `.font-arabic` always gets Cairo, and anything
tagged `lang="en"` always gets Plus Jakarta Sans, regardless of the page's overall
direction. That's what makes a mixed line like "Sign In / دخول" render both halves in
the correct typeface at once.

## Weight

- **Headings:** bold / extrabold (Cairo bold for Arabic headings, Jakarta extrabold for
  Latin — e.g. page titles use `font-extrabold`)
- **Body / labels:** regular to semibold
- **Buttons, section labels:** semibold to bold, often with wide letter-spacing when
  uppercase (see Section Dividers below)

## The bilingual label pattern (used everywhere — this is a core brand rule, not just a component)

Every shared label, button, and heading in the app follows one fixed pattern:

```
English Label / العربية
```

English first, a forward slash, Arabic second, always on one line. This isn't just a
translation convenience — it's the visual identity of the whole app, echoing the dual
دكة / Dekka lockup in the logo itself.

Implementation note for anyone extending this: the pair is always wrapped in
`dir="ltr"` with each half separately tagged `lang="en"` / `lang="ar"`. Without the
explicit `dir="ltr"` wrapper, the whole run reverses inside the Arabic (RTL) page layout
and would render Arabic-first — which breaks the pattern. See `BilingualLabel` in
`04-components.md`.

**When not to bilingual-pair:** body copy and long-form content (event descriptions,
paragraphs) follow the locale toggle instead — showing every paragraph in both
languages at once would double the reading length of the whole site. The bilingual
pattern is reserved for field labels, buttons, and headings.

## Scale (as used across the app)

| Use | Approx size | Weight |
|---|---|---|
| Hero headline (auth screen) | 2.25rem – 3rem (`text-4xl` → `text-5xl`) | Extrabold |
| Page title | 1.5rem – 1.875rem (`text-2xl` → `text-3xl`) | Extrabold |
| Section label / divider | 0.65rem, uppercase, `tracking-[0.18em]` | Semibold |
| Body | 0.95rem | Regular |
| Field label | 0.875rem (`text-sm`) | Bold |
| Helper / muted text | 0.875rem | Regular |
| Badge / tag | 0.75rem (`text-xs`) | Semibold |
