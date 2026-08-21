# Colors

Dekka runs **two themes off one palette** — nothing is invented per-theme, the light
workspace just pulls from the same brown/tan/cream family the dark app uses. Source of
truth: the `@theme` block in `app/globals.css`.

## Dark theme — the public app (events, auth, submit-a-show)

This is the "coffeehouse at night" mood — the whole guest-facing site.

| Token | Hex | Used for |
|---|---|---|
| `ink-black` | `#18120D` | Page background |
| `coffee` | `#3B2A1F` | Secondary dark surface (hover states, footer) |
| `surface-dark` | `#241B14` | Cards, input fields |
| `border-dark` | `#4A3B2C` | Input/card/button outlines |
| `on-dark` | `#F5F0EA` | Headings and body text on dark backgrounds |
| `text-muted` | `#9C9086` | Placeholder text, helper text, secondary labels |

## Accents — shared by both themes

| Token | Hex | Used for |
|---|---|---|
| `gold-accent` | `#D9A566` | Primary buttons (as a gradient), headings, links, focus rings |
| `gold-accent-deep` | `#C08A52` | Gradient end-stop for primary buttons |
| `tan-muted` | `#B08968` | Secondary labels, dividers, small links, logo badge ring |
| `cream` | `#F3E6D8` | Logo badge background, light accent cards on the dark app |

## Light theme — the back-office (staff door, admin dashboard)

Same family, flipped for high-contrast data entry at a counter.

| Token | Hex | Used for |
|---|---|---|
| `ink` | `#241611` | Primary text |
| `ink-soft` | `#4A342A` | Secondary text, hover states |
| `ink-faint` | `#8A7466` | Placeholder text, muted labels |
| `gold` | `#C08B4A` | Primary buttons, links |
| `gold-deep` | `#9A6B33` | Button hover/active |
| `gold-wash` | `#F0E2CC` | Selection highlight, hover backgrounds |
| `paper` | `#FFFBF3` | Page background, cards |
| `line` | `#E2D6C2` | Hairlines, table borders |

## Status colors (used in both themes)

| Token | Hex | Meaning |
|---|---|---|
| `good` | `#5C9C74` | Success, confirmed, approved |
| `warn` | `#D9A566` | Pending, warning (shares the gold accent) |
| `bad` | `#C2604A` | Error, declined, cancelled |

## How the flip actually works

Rather than pass a `theme` prop through every component, each shared UI primitive
(`.dk-card`, `.dk-field`, `.dk-label`, `.dk-muted`, `.dk-thead`, `.dk-hairline`) has one
class whose colors change automatically inside a `.dk-workspace` ancestor. So the exact
same `<Card>` component renders dark on the public site and cream in the admin
dashboard — nothing needs to be built twice.

```css
.dk-card {
  background-color: var(--color-surface-dark); /* dark, by default */
}
.dk-workspace .dk-card {
  background-color: var(--color-paper); /* cream, inside the back-office */
}
```

**Rule of thumb when adding anything new:** if it's public-facing, it's dark with gold
accents. If it's a staff/admin tool, wrap it in `.dk-workspace` and it becomes cream
automatically — don't hand-pick colors for a new screen.
