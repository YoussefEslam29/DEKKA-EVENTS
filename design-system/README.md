# Dekka — Design System

This folder is Dekka's `/design-system` — the visual reference every AI chat and every
developer reads before touching a screen. It follows the same "foundation docs" pattern
described in the two workflow guides in the project: one folder for *how it looks*, one
`developer-guide.md` (still to write, if you want it) for *how it's built*.

Nothing in here is invented. Every token, font, and component below is pulled directly
from the code that's already shipped — `app/globals.css`, `components/ui/*`,
`components/layout/*`, and the two planning docs already in `PLAN/`
(`idea.md` and `authorization-UI.md`). This folder is the "read this first" summary of
those, organized the way a designer or a new AI session would want it, not the way it's
scattered across the codebase.

## What's inside

| File | Answers |
|---|---|
| [`01-colors.md`](01-colors.md) | What are the brand colors, and which theme uses which? |
| [`02-typography.md`](02-typography.md) | What fonts, what sizes, how does bilingual text work? |
| [`03-spacing-radius.md`](03-spacing-radius.md) | What are the spacing and corner-radius rules? |
| [`04-components.md`](04-components.md) | What UI pieces already exist — buttons, fields, cards — and how do I use them? |
| [`05-brand-assets.md`](05-brand-assets.md) | Where's the logo, how do I place it, what NOT to do with it |
| [`06-tone-of-voice.md`](06-tone-of-voice.md) | How does Dekka "talk" — in English and in Arabic? |
| [`assets/`](assets/) | Copies of the real logo, square logo, and banner, for quick reference outside the codebase |

## The one-paragraph version

Dekka (دكة) is a coffee shop that runs live events. The brand is warm, coffeehouse,
a little indie — **deep coffee brown ink, warm tan/gold accents, cream backgrounds**,
built around a tatreez (Palestinian geometric embroidery) texture lifted straight from
the logo's own artwork. The public-facing app (events, auth, submit-a-show) runs a
**dark "coffeehouse at night" theme**; the back-office (staff door check-in, admin
dashboard) runs a **light cream workspace theme** because those are fast, data-entry
tools used at a counter. Arabic is the default language (RTL); English is a toggle, not
an afterthought — most labels and headings show both at once (`English / العربية`).

## Where this lives in the codebase

- Tokens: `app/globals.css` (the `@theme` block + the `.dk-*` component classes)
- Components: `components/ui/*`, `components/layout/*`, `components/auth/*`
- Fonts: `app/layout.tsx` (Cairo + Plus Jakarta Sans via `next/font/google`)
- Original planning docs: `PLAN/idea.md` (product) and `PLAN/authorization-UI.md`
  (the original visual spec this was all implemented from)
- Raw brand source files: `IMGS/` — run `npm run brand:assets` to regenerate
  `public/brand/*` if the source artwork ever changes
