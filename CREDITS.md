# Credits & third-party assets

Everything in this repo that someone else owns, and what its licence requires of us.
The code itself is GPL-3.0 (see [`LICENSE`](LICENSE)); this file covers the *assets*,
which that licence does not speak for.

## Fonts

| Font | Where it's used | Licence |
|---|---|---|
| **Cairo** — Copyright 2009 The Cairo Project Authors ([source](https://github.com/Gue3bara/Cairo)) | The Arabic face across the whole UI, loaded via `next/font/google` in `app/layout.tsx`. **Also redistributed in this repo** as `lib/report/fonts/Cairo.ttf`, embedded as a data URI in the generated PDF reports (`lib/report/html.ts`). | SIL Open Font License 1.1 — full text at [`lib/report/fonts/OFL.txt`](lib/report/fonts/OFL.txt), which is what the licence requires us to ship alongside the binary. |
| **Plus Jakarta Sans** — Copyright 2020 The Plus Jakarta Sans Project Authors ([source](https://github.com/tokotype/PlusJakartaSans)) | The Latin face, loaded via `next/font/google` in `app/layout.tsx`. Downloaded and self-hosted at build time; **not** redistributed in this repo. | SIL Open Font License 1.1. |

## Icons

| Asset | Licence / status |
|---|---|
| **lucide-react** — Copyright Lucide Icons and Contributors | ISC. Ordinary npm dependency, nothing to ship. |
| The Google, Apple, Facebook, Instagram and TikTok marks in `components/BrandIcons.tsx` | Third-party trademarks, used only to label "sign in with…" buttons and links to our own profiles on those platforms — the use each platform's brand guidelines provide for. Not ours, and not licensed to us for any other purpose. The Instagram/Facebook/TikTok glyphs are hand-drawn approximations rather than the official marks; the Google "G" and the Apple logo are the real marks, because those two platforms require their own artwork on their sign-in buttons. |

## Images

**Shipped to the live site** — everything under `public/`:

| File | Used by | Provenance |
|---|---|---|
| `public/brand/dekka-logo.png` | `components/ui/LogoBadge.tsx` (navbar, footer, auth screens) | Commissioned work — the Dekka logo, made for Dekka by a designer. Generated from `IMGS/DEKKA LOGO.jpg` by `scripts/prepare-brand-assets.ts`. See the note on commissioned artwork below. |
| `public/brand/dekka-logo-square.png` | Favicon (`app/layout.tsx`) and the push-notification icon (`public/sw.js`) | Same commissioned logo as above. |
| `public/brand/dekka-banner.jpg` | Currently unreferenced — kept for a future share/OG image. | From `IMGS/DEKKA BANNER.jpg`. **{{CONFIRM PROVENANCE}}** |

**Source material** — `IMGS/` is design source, not served by the app, but it is committed to
this repo and therefore redistributed with it. Each of these needs an answer before the repo
is shared publicly:

| File | Provenance |
|---|---|
| `IMGS/DEKKA LOGO.jpg`, `IMGS/dekka_logo_dark_transparent.png`, `IMGS/dekka_logo_white_transparent.png` | Commissioned work — drawn for Dekka by a designer. See the note on commissioned artwork below. |
| `IMGS/DEKKA BANNER.jpg`, `IMGS/Main@1x.png` | **{{CONFIRM PROVENANCE}}** |
| `IMGS/Coffee icon illustration.jpg`, `IMGS/Motion graphics of a coffee cup.jpg` | **{{CONFIRM PROVENANCE}}** — generic filenames with no attribution anywhere. If either came from a stock site, record the licence and, where required, the attribution line here. |
| `IMGS/Karaoke Night Poster.pdf`, `IMGS/drawing contestjpg.jpg` | **{{CONFIRM PROVENANCE}}** — event artwork; confirm who made it and whether any photo or typeface inside it carries its own terms. |
| `IMGS/Dekka - Google Maps.pdf` | A capture of Google Maps. Google Maps content is Google's, under their terms — fine as an internal reference, but don't republish it as site artwork. |

## Content the app accepts at runtime

Two paths let an admin put an image or text on a public page without anyone else reviewing
it, so responsibility for rights sits with whoever types it in:

- **Uploaded event posters and member profile photos** → Vercel Blob (or `public/uploads/`
  locally, which is git-ignored). Nothing in the pipeline checks who owns an upload.
- **Pasted external cover-image URLs** — `next.config.ts` deliberately allows an image URL on
  any HTTPS host, so a poster can be linked rather than uploaded. `components/EventForm.tsx`
  shows a reminder next to that field for exactly this reason.

## A note on commissioned artwork

The logo was made for Dekka by a designer. Worth knowing: commissioning a design and
*owning* it are not automatically the same thing — in most jurisdictions, including Egypt,
copyright stays with the person who drew it unless the agreement says otherwise. In practice
a designer who delivered a logo for a cafe to use plainly intended the cafe to use it, so
day-to-day this is fine.

It only becomes a live question if Dekka ever wants to register the logo as a trademark, sell
the business, or stop someone else from using the mark. If any of that is on the cards, ask
the designer for one line in writing assigning the rights to Dekka, and record it here.

## Fixing a `{{CONFIRM PROVENANCE}}` row

Replace the marker with one of: `Own work — <who made it>, <year>`; `Licensed — <source>,
<licence>, <link>`; `AI-generated — <tool>, <date>`; or `Public domain / <licence> — <source>`.
If an asset turns out to be unlicensed, replace the file rather than leaving the row unresolved.
