# Spacing & Radius

## Border radius

| Context | Radius | Notes |
|---|---|---|
| Public app (dark theme) | 12px (inputs) – 14px (cards) – full pill (primary buttons) | Soft, friendly, "app-like" |
| Back-office (`.dk-workspace`) | `--radius-brand` = **4px**, everywhere | Deliberately sharper/tighter — a workspace tool, not a consumer app |
| Logo badge | 10px (small) up to 24px (large) rounded square | Scales with size, see `04-components.md` |

The 4px "brand radius" in the workspace is intentional and named as its own token
(`--radius-brand`) rather than reusing Tailwind's defaults — keep using that token if
you add new admin/staff screens, don't reach for `rounded-lg`/`rounded-xl` there.

## Button sizing

| Size | Height | Padding | Text | Radius |
|---|---|---|---|---|
| `sm` | 32px | 12px | 0.875rem | `rounded-lg` |
| `md` (default) | 40px | 16px | 0.875rem | `rounded-xl` |
| `lg` | 48px | 24px | 1rem | `rounded-xl` |
| `pill` | 52px | 24px | 1rem | fully rounded |

## Field / input spacing

- Vertical padding: `0.8rem` (dark theme) / `0.6rem` (workspace)
- Horizontal padding: `0.9rem` (dark theme) / `0.75rem` (workspace), `ps-11` when a
  leading icon is present so the icon never overlaps the text
- Field-to-field vertical gap: `mb-4` (1rem) is the standard rhythm between stacked
  form fields across the whole app

## Layout rhythm

- Content max-width: `1180px` (navbar, footer, and most page containers)
- Auth form max-width: `420px`, centered
- Page padding: `px-4` on mobile, `px-8` from `md:` up
- Section gaps on the footer/admin grids: `gap-8`

## Why this matters for new screens

Don't introduce new spacing or radius values by eyeballing it — reuse `mb-4` between
fields, the existing button size scale, and `--radius-brand` inside `.dk-workspace`.
The brand's "sharp cream workspace vs. soft dark app" contrast is a deliberate design
decision (see `authorization-UI.md` §8) and gets diluted if the two start borrowing
each other's radius values.
