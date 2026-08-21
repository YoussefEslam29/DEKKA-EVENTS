# Brand Assets

## The files

| File | What it is | Where |
|---|---|---|
| `dekka-logo.png` | The دكة wordmark + "Dekka" Latin lockup, matted to a transparent background, trimmed tight | `public/brand/dekka-logo.png` |
| `dekka-logo-square.png` | 512×512 square version, used as the favicon | `public/brand/dekka-logo-square.png` |
| `dekka-banner.jpg` | The full cream collage banner — logo centered, "COFFEE SHOP" beneath it, coffee photography and bean line-art framing it | `public/brand/dekka-banner.jpg` |

Copies of all three are also in this folder's [`assets/`](assets/) directory for quick
reference without digging into the codebase.

The **originals** (as supplied, before processing) live in `IMGS/` at the project root.
Running `npm run brand:assets` regenerates the three files above from those originals —
re-run it if the source artwork ever changes.

## The mark itself

The wordmark is the Arabic **دكة** rendered in bold, angular calligraphy, textured with
a mirrored geometric diamond/chevron pattern — a Levantine/Palestinian tatreez-style
motif. This is Dekka's single strongest, most distinctive brand asset, which is why it
also lives on as `PatternAccent` (see `04-components.md`) — reused as a texture across
the app, not just as the logo.

A small Latin "Dekka" wordmark sits underneath as the secondary lockup for the English
side of the bilingual toggle.

## The one rule that matters most

**The logo is dark brown ink.** On `ink-black` (the public app's background) it
nearly disappears. Every single place the logo appears on a dark surface, it sits
inside a **cream rounded-plate badge** — that's what `LogoBadge` does automatically.
Never place the raw `dekka-logo.png` directly on a dark background without the badge.
On cream/light surfaces (the banner itself, back-office pages), the raw lockup
(`LogoLockup`) is fine on its own.

## Tagline

If a tagline is used under the logo, it's **"COFFEE SHOP"** — the real copy pulled
from the banner. An earlier placeholder mockup used a fabricated "COFFEE & COMMUNITY"
circle badge; that does not exist in the real brand and should never be reintroduced.

## Photography

No real Dekka interior/event photography exists yet. Anywhere a photo is called for
(the auth screen's hero panel, event cover images), the app falls back to a
brand-derived treatment — warm pendant-light gradients over deep coffee, with the
tatreez texture — rather than shipping stock photography that isn't actually Dekka.
The moment real photos exist, drop them in (`public/brand/auth-hero.jpg` for the auth
hero; event cover images are admin-entered URLs) and the fallback disappears
automatically, no code change required.

## Social presence

Instagram, Facebook, and TikTok are linked from the footer and About page — surfaced
in-app, not replaced. Google Maps is linked/embedded on the event detail and About
pages for directions. URLs live in `lib/site.ts`, overridable via environment
variables so the owner can update them without a code change.
