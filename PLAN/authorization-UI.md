# Dekka — Authorization UI/UX Spec (authorization-UI.md)

For Claude Code to implement. This defines the auth screens pixel-for-pixel from the reference
mockups, with the **real Dekka logo swapped in for the generated placeholder**, plus guidance for
carrying this look across the rest of the site/app.

---

## 1. Brand Assets — Use Real Files Only

The reference mockups (desktop + mobile "Welcome Back" screens) used a **generated placeholder
logo**: a circular badge with a fabricated "COFFEE & COMMUNITY" tagline. That badge does not
exist in the real brand — **remove it**.

**Real assets to use instead** (as provided):
- `DEKKA_LOGO.jpg` — the دكة wordmark + "Dekka" lockup (dark brown ink, tan geometric texture,
  on white/transparent). This is the primary mark — use it everywhere the mockup shows a logo.
- `DEKKA_BANNER.jpg` — the cream collage banner with the logo centered and "**COFFEE SHOP**"
  beneath it. If a tagline is wanted under the logo, use **"COFFEE SHOP"** (real copy from the
  banner) — not "COFFEE & COMMUNITY" (that was invented for the mockup).

**Important implementation note:** the real logo file is dark ink on a light/transparent
background — it will disappear on dark surfaces. Ask for (or export) a **transparent PNG** version
before implementation. Anywhere the logo sits on a dark background (auth screen, dark nav bars,
etc.), place it inside a small **cream rounded-square or circle badge** (like the mockup does) so
it stays legible — just swap the artwork inside that badge for the real logo, and drop the fake
tagline.

---

## 2. Color Tokens

| Token | Hex (approx) | Used for |
|---|---|---|
| `ink-black` | `#18120D` | Dark panel / mobile background |
| `coffee-brown` | `#3B2A1F` | Dark text on light surfaces, secondary dark surface |
| `surface-dark` | `#241B14` | Input fields, cards on dark backgrounds |
| `border-dark` | `#4A3B2C` | Input/button outlines on dark surfaces |
| `gold-accent` | `#D9A566` → `#C08A52` (gradient) | Primary buttons, headings, links, focus states |
| `tan-muted` | `#B08968` | Secondary labels, dividers, small links |
| `cream` | `#F3E6D8` | Light backgrounds, logo badge, light-surface cards |
| `text-onDark` | `#F5F0EA` | Headings/body text on dark backgrounds |
| `text-muted` | `#9C9086` | Placeholder text, helper text, "OR CONTINUE WITH" |

These are the same brown/tan/cream family already in the real logo and banner — nothing new is
introduced, just extended into a full UI palette.

---

## 3. Typography

- **Arabic:** Cairo or Tajawal, bold weight for headings, regular for body/labels.
- **Latin:** A rounded/geometric sans (e.g. Poppins or Plus Jakarta Sans) to match the bold
  rounded feel of "Welcome Back" in the mockups.
- **Bilingual label pattern** used everywhere (see mockups): `English Label / العربية` on one
  line — English first, forward slash, Arabic second. Keep this pattern consistent across the
  whole app, not just auth.

---

## 4. Desktop Auth Layout (≥1024px) — Split Screen

**Left panel (~60% width):**
- Full-bleed, dark, ambient cafe photo (warm pendant lighting, espresso bar, moody — same style
  as the reference: real Dekka interior photos should replace any stock photo once available).
- Dark gradient overlay, strongest at bottom-left, for text legibility.
- Overlaid headline, bottom-left, stacked:
  - Bold headline in `cream`/`text-onDark`, large (e.g. "Where heritage meets the brew.")
  - Arabic translation directly below, smaller, lighter weight.
- This copy should rotate per context (login vs. signup can have different lines) but always
  follow this English-bold / Arabic-light two-line pattern.

**Right panel (~40% width):**
- Background: `ink-black`.
- Vertically centered content, max-width ~420px, generous vertical rhythm.
- Order top to bottom:
  1. Logo badge (cream card, real logo inside, no fabricated tagline — or "COFFEE SHOP" if a
     tagline is wanted)
  2. Heading: "Welcome Back" (`gold-accent`), Arabic subheading below in `text-onDark`/muted
  3. Field: bilingual label (bold, `text-onDark`) above a `surface-dark` input with
     `border-dark` outline, rounded corners, placeholder in `text-muted`
  4. Password field: same input style + eye-icon toggle (right-aligned) + "Forgot?" link
     (`gold-accent`) aligned opposite the label
  5. Primary button: full-width, `gold-accent` gradient fill, dark text, rounded, bilingual
     label + arrow icon ("Sign In / دخول →")
  6. Divider: "OR CONTINUE WITH" centered, thin `border-dark` lines either side, `text-muted`,
     letter-spaced uppercase
  7. Social buttons: outlined (`border-dark` on `ink-black`/`surface-dark`), full-width, stacked,
     icon + label ("Continue with Google", "Continue with Facebook")
  8. Bottom switch link: muted text + bold `gold-accent` link ("Don't have an account? Create
     one / سجل الآن")
  9. Optional subtle decorative element at the very bottom: reuse the geometric tatreez pattern
     from the logo (thin, low-opacity) as a footer flourish — ties the form back to the brand mark.

---

## 5. Mobile Auth Layout (<768px) — Single Column

- No split photo — full `ink-black` background, matching the mobile reference exactly.
- Centered logo badge at top (same swap rule: real logo, no fake tagline).
- "Welcome Back" heading in `text-onDark` (white, not gold, on mobile per reference) + Arabic
  subheading in muted gray below.
- Inputs: same dark rounded style, but **with leading icons** (envelope for email, lock for
  password) as shown in the mobile mock — desktop can be icon-less to match its reference, or
  add icons too for consistency; recommend keeping icons on both for one shared input component.
- "Forgot Password?" bilingual link, right-aligned, `gold-accent`.
- Primary button: same gold gradient pill, full width, "Sign In تسجيل الدخول →".
- Divider: "OR CONTINUE WITH".
- Social buttons: **side-by-side** (not stacked) on mobile — "Google" and "Apple" (mobile uses
  Apple instead of Facebook; confirm below whether this split is intentional).
- Bottom switch link: "New to Dekka? / جديد في دكة؟ **Sign Up / إنشاء حساب**".

---

## 6. Reusable Component Library (build once, use everywhere)

| Component | Spec |
|---|---|
| `LogoBadge` | Cream rounded-square/circle, real logo artwork, optional "COFFEE SHOP" tagline, used on any dark surface |
| `PrimaryButton` | Gold gradient fill, dark text, full width, rounded, bilingual label + optional icon |
| `OutlineButton` | Dark surface, `border-dark` outline, used for social auth + secondary actions |
| `TextField` | Bilingual label above, dark rounded input, optional leading icon, `text-muted` placeholder |
| `PasswordField` | `TextField` + trailing eye-icon visibility toggle |
| `SectionDivider` | Centered label, thin lines either side, uppercase, letter-spaced, `text-muted` |
| `BilingualLabel` | Enforces the `English / العربية` pattern app-wide (not just auth) |
| `PatternAccent` | Low-opacity geometric tatreez motif (pulled from the logo texture) — reusable as a section divider, empty-state background, or loading-skeleton texture |

---

## 7. Missing State — "Continue as Guest"

The idea.md plan requires **Login / Sign Up / Continue as Guest**, but neither reference mockup
shows a guest option. Recommendation: add a third, lower-emphasis action beneath the social
buttons — plain text link, `text-muted` with `gold-accent` on hover/press:
`Continue as Guest / المتابعة كزائر`
Placed below the "Create one / Sign Up" line so it doesn't compete visually with the primary
sign-in/sign-up actions, but is still one tap away.

---

## 8. Applying This System Site-Wide

**Recommended direction:** carry the **dark, moody "coffeehouse at night" theme** across the
whole public-facing app (Events Hub, Event Detail, My Events, Submit Your Show) — not just auth.
It matches the live-music-venue side of Dekka's identity better than a bright daytime cafe look,
and it's what's already fully designed in these mockups. Use `cream`/light surfaces as the
*accent* (cards, badges, the logo) rather than the base.

**Exception to consider:** the **Staff Door Check-In** and **Admin Dashboard** are back-office,
data-entry-heavy tools used at a counter — a lighter, higher-contrast `cream`/white workspace
theme may be easier to read/enter data into quickly than a dark theme. Flagged as an open
decision below.

Concretely, reuse across the site:
- Same `PrimaryButton` / `OutlineButton` styles for "Reserve my spot," "Submit," "Apply," etc.
- Same dark input styling for the Submit-Your-Show form fields.
- Same bilingual label pattern on every field and heading, everywhere.
- Event Detail hero: same treatment as the auth left panel — dark photo + gradient + bold
  headline/Arabic subhead overlay, but showing the event's own image instead of the cafe interior.
- `PatternAccent` (the tatreez texture) as a recurring divider between sections on the Events
  Hub and Event Detail pages, and as the loading/skeleton pattern while events load.

---

## 9. Open Questions for You

1. **Dark theme scope:** dark theme for the entire public app (recommended), or just auth + hero
   sections, with the rest lighter/cream?
2. **Admin/Staff theme:** keep the same dark theme for the dashboard and door check-in table, or
   switch those to a light/cream workspace theme for easier data entry?
3. **Social providers:** desktop mock shows Google + Facebook, mobile shows Google + Apple —
   intentional per-platform split, or should both platforms offer the same three (Google,
   Facebook, Apple)?
4. **Tagline under the logo:** use "COFFEE SHOP" (real, from the banner), no tagline at all, or
   something else?
5. **Real photography:** the left-panel cafe photo in the desktop mock is a stock/generated
   image — do you have real interior/event photos of Dekka to use here instead?
