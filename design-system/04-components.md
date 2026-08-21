# Components

Every shared UI piece already exists in `components/ui/` — build new screens out of
these rather than one-off styling. All of them respect the dark/light flip described in
`01-colors.md` automatically.

## Button

`components/ui/Button.tsx` — one button, eight variants, four sizes.

| Variant | Looks like | Use for |
|---|---|---|
| `gold` (default) | Gold gradient fill, dark ink text | Primary actions — "Reserve my spot", "Sign In", "Submit" |
| `outline` | Dark surface, subtle border | Social sign-in, secondary actions on the public app |
| `ghost` | Transparent, fills on hover | Low-emphasis actions on dark surfaces |
| `dark` | Solid coffee-brown fill | Alternate secondary action |
| `danger` | Solid red-brown fill | Destructive actions (cancel, delete) |
| `lightPrimary` / `lightOutline` / `lightGhost` | Ink-on-cream equivalents | Same jobs, inside `.dk-workspace` (admin/staff) |

```tsx
<Button variant="gold" size="lg">Sign In / دخول →</Button>
<Button variant="outline">Continue with Google</Button>
```

## Text inputs

`components/ui/TextField.tsx`

- **`TextField`** — bilingual label above a dark rounded input, optional leading icon
  (envelope, lock, etc.), optional trailing "action" slot (used for "Forgot?" links).
- **`PasswordField`** — `TextField` plus a trailing eye-icon show/hide toggle.
- **`TextAreaField`** — same label pattern, multi-line, used for the Submit-a-Show pitch.

```tsx
<TextField labelEn="Email" labelAr="البريد الإلكتروني" icon={Mail} dir="ltr" />
<PasswordField labelEn="Password" labelAr="كلمة المرور" icon={Lock}
  action={<a href="/forgot" className="text-xs text-gold-accent">Forgot?</a>} />
```

Note: email/phone/password inputs are always rendered `dir="ltr"` even inside the
Arabic layout, because their *content* (Latin letters, digits) needs LTR affordances —
otherwise the leading icon and text cursor land on the wrong side.

For the plain, non-bilingual back-office forms (admin/staff), use the lighter
`components/ui/Field.tsx` primitives instead: `Label`, `Input`, `Textarea`, `Select`,
and `FormRow` (label + control + error in one wrapper).

## Cards & surfaces

`components/ui/Surface.tsx`

- **`Card`** — the base panel (`.dk-card`), dark on the public app, cream in the
  workspace, automatically.
- **`Badge`** — small status pill, tones: `neutral`, `gold`, `good`, `warn`, `bad`
  (maps directly to the status colors in `01-colors.md`).
- **`PageHeader`** — title + optional subtitle + optional action button, the standard
  header for every admin/staff page.
- **`EmptyState`** — dashed-border placeholder for "nothing here yet" states.

```tsx
<Card className="p-6">
  <Badge tone="good">Confirmed</Badge>
</Card>
```

## Logo badge

`components/ui/LogoBadge.tsx`

- **`LogoBadge`** — the real دكة mark on a cream rounded plate. **Always use this**
  when the logo needs to sit on a dark background — the raw logo file is dark ink and
  disappears on `ink-black` without the cream plate behind it. Sizes: `sm` (nav),
  `md` (footer), `lg`, `xl` (auth/hero). Pass `tagline` to add "COFFEE SHOP" beneath it.
- **`LogoLockup`** — the raw logo at any width, for use directly on cream/light
  surfaces where no badge plate is needed.

```tsx
<LogoBadge size="sm" />          // navbar
<LogoBadge size="md" tagline />  // footer
```

## Pattern accent (the tatreez motif)

`components/ui/PatternAccent.tsx` — the nested-diamond geometric pattern lifted
straight from the logo's own texture, drawn as a CSS mask tinted by `currentColor`, so
one definition reused as: a thin divider band (`variant="band"`), a full-bleed
watermark/skeleton texture (`variant="field"`), always **low-opacity** — it should read
as a woven edge, never a loud border.

```tsx
<PatternAccent />                                    // thin divider
<PatternAccent variant="field" className="opacity-5" /> // background texture
```

## Section divider

`components/ui/SectionDivider.tsx` — centered uppercase label with a hairline either
side (e.g. "OR CONTINUE WITH"). Takes `tone="dark" | "light"`.

```tsx
<SectionDivider label="OR CONTINUE WITH" />
```

## Bilingual label

`components/ui/BilingualLabel.tsx` — the component version of the typography rule in
`02-typography.md`. Renders `en / ar` on one line with correct `lang`/`dir` per half. If
`en` and `ar` are identical strings (e.g. a proper noun), it renders once, not twice.

```tsx
<BilingualLabel en="Reserve my spot" ar="احجز مكانك" />
```

## Layout chrome

- **`Navbar`** (`components/layout/Navbar.tsx`) — always dark, even on cream
  back-office pages, so the brand chrome reads as one consistent piece rather than
  re-skinning per route. Links adapt by role (staff/admin links only show for those
  roles). No-JS `<details>` disclosure for the mobile menu — no client JS needed.
- **`Footer`** (`components/layout/Footer.tsx`) — logo + tagline, social links
  (Instagram/Facebook/TikTok/Maps, from `lib/site.ts`), address + hours, topped with a
  `PatternAccent` divider.
- **`AuthScreen`** (`components/auth/AuthScreen.tsx`) — the reference implementation
  of the 60/40 desktop split → single dark column on mobile, described fully in
  `authorization-UI.md` §4–5. Falls back to a brand-derived gradient + tatreez texture
  for the hero photo until real Dekka interior photography exists — drop a file at
  `public/brand/auth-hero.jpg` and it's picked up automatically, no code change needed.

## Component checklist for anything new

Before styling a new screen from scratch, check whether it's really just:
`PageHeader` + `Card` + `TextField`/`Field` primitives + `Button` + `Badge`. Almost
every screen in Dekka today is built from that same handful of pieces.
