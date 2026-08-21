# Graph Report - DEKKA-EVENTS  (2026-08-21)

## Corpus Check
- 112 files · ~73,251 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 579 nodes · 1367 edges · 64 communities (27 shown, 37 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.85)
- Token cost: 329,006 input · 0 output

## Community Hubs (Navigation)
- Admin Event Pages
- Error & Submission Pages
- API Route Handlers
- Auth & Role Bootstrap
- NPM Dependencies
- Public Site Pages
- Design System Docs
- TypeScript Config Types
- Login & Signup Pages
- Dev Tooling Dependencies
- Product Features Overview
- Auth UI Open Questions
- Brand Asset Prep Script
- Light/Dark Theme Tokens
- DEKKA Logo Assets
- Next.js Boilerplate Icons
- Button Component
- PatternAccent Component
- Color Token Variants
- Font & Typography Setup
- SectionDivider Component
- TextField Component
- Arabic-First Copywriting
- Coffee Shop Banner Duplicates
- Auth Screen Layouts
- Footer & Social Links
- PasswordField Component
- Surface UI Primitives
- Coffeehouse Brand Voice
- ESLint Config
- Next.js Config
- Bilingual Locale Handling
- Data Model & Lifecycle
- V1 Scope Exclusions
- PostCSS Config
- Screenshot Script Targets
- Route Method Exports
- Status Color Tokens
- Typography Size Scale
- Typography Weight Scale
- Button Sizing Scale
- Field Spacing Rules
- Layout Rhythm Rules
- Field Primitives Component
- Navbar Component
- TextAreaField Component
- Public Brand Banner
- Favicon Logo Asset
- Copy Tone Rule
- Design System Codebase Map
- Design System Summary
- Brand Banner Asset
- Brand Wordmark Asset
- Band/Artist Role
- Dekka Brand Identity
- Guest Role
- Social Links Feature
- NextAuth Framework
- Shared Enum Constants
- CSS Layer Gotcha
- Screenshot Capture Script
- Dekka Tech Stack

## God Nodes (most connected - your core abstractions)
1. `getI18n()` - 41 edges
2. `connectDB()` - 37 edges
3. `cn()` - 30 edges
4. `handle()` - 28 edges
5. `currentUser()` - 26 edges
6. `useI18n()` - 25 edges
7. `jsonError()` - 23 edges
8. `guard()` - 21 edges
9. `buttonStyles` - 18 edges
10. `formatTime()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Site-Wide Dark 'Coffeehouse at Night' Theme` --semantically_similar_to--> `Warm/Communal Brand Voice`  [INFERRED] [semantically similar]
  PLAN/authorization-UI.md → design-system/06-tone-of-voice.md
- `Deliberately Out of Scope for v1` --semantically_similar_to--> `Known Gaps`  [INFERRED] [semantically similar]
  PLAN/idea.md → README.md
- `Component Reuse Checklist` --semantically_similar_to--> `Hand-Rolled UI Primitives`  [INFERRED] [semantically similar]
  design-system/04-components.md → README.md
- `Dekka Coffee Shop Banner (IMGS copy)` --semantically_similar_to--> `Dekka Coffee Shop Banner (design-system asset)`  [INFERRED] [semantically similar]
  IMGS/DEKKA BANNER.jpg → design-system/assets/dekka-banner.jpg
- `Dekka Coffee Shop Banner (IMGS copy)` --semantically_similar_to--> `Dekka Coffee Shop Banner (public brand asset)`  [INFERRED] [semantically similar]
  IMGS/DEKKA BANNER.jpg → public/brand/dekka-banner.jpg

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Dual Dark/Light Theme Flip via .dk-workspace** — design_system_01_colors_theme_flip_mechanism, plan_authorization_ui_staff_admin_theme_exception, design_system_03_spacing_radius_border_radius, readme_two_surfaces_one_palette [INFERRED 0.85]
- **Bilingual Label Pattern Across Spec, Typography, Component, and README** — plan_authorization_ui_bilinguallabel, design_system_02_typography_bilingual_pattern, design_system_04_components_bilinguallabel, readme_bilingual_labels_section [INFERRED 0.85]
- **Brand Asset Flow: Raw Logo to Processed Asset to LogoBadge** — plan_authorization_ui_dekka_logo_jpg, readme_brand_assets_pipeline, design_system_05_brand_assets_dekka_logo_png, design_system_04_components_logobadge [INFERRED 0.75]

## Communities (64 total, 37 thin omitted)

### Community 0 - "Admin Event Pages"
Cohesion: 0.07
Nodes (68): NotFound(), AdminEventDetailPage(), NewEventPage(), AdminEventsPage(), dynamic, statusTone, AdminOverviewPage(), dynamic (+60 more)

### Community 1 - "Error & Submission Pages"
Cohesion: 0.07
Nodes (46): GlobalError(), dynamic, dynamic, AdminSubmissionsPage(), dynamic, dynamic, dynamic, OAuthAvailability (+38 more)

### Community 2 - "API Route Handlers"
Cohesion: 0.10
Nodes (57): DELETE(), Params, GET(), Params, POST(), GET(), Params, POST() (+49 more)

### Community 3 - "Auth & Role Bootstrap"
Cohesion: 0.08
Nodes (33): adminEmails, { handlers, signIn, signOut, auth }, providers, staffEmails, EVENT_STATUSES, EventStatus, PAYMENT_METHODS, PaymentMethod (+25 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.06
Nodes (34): bcryptjs, class-variance-authority, clsx, lucide-react, mongoose, next, next-auth, dependencies (+26 more)

### Community 5 - "Public Site Pages"
Cohesion: 0.11
Nodes (21): AboutPage(), dynamic, AuthForm(), AppleIcon(), FacebookIcon(), GoogleIcon(), IconProps, InstagramIcon() (+13 more)

### Community 6 - "Design System Docs"
Cohesion: 0.07
Nodes (30): Design System — Colors, app/globals.css @theme block, Design System — Typography, Bilingual Label Pattern (English / العربية), Design System — Spacing & Radius, Design System — Components, BilingualLabel (components/ui/BilingualLabel.tsx), Component Reuse Checklist (+22 more)

### Community 7 - "TypeScript Config Types"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 8 - "Login & Signup Pages"
Cohesion: 0.10
Nodes (20): dynamic, LoginPage(), safeNext(), dynamic, safeNext(), SignupPage(), cairo, jakarta (+12 more)

### Community 9 - "Dev Tooling Dependencies"
Cohesion: 0.09
Nodes (23): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, puppeteer-core, sharp, tailwindcss (+15 more)

### Community 10 - "Product Features Overview"
Cohesion: 0.16
Nodes (14): Admin Dashboard Feature, Admin Role, Door / Check-in Table Feature, Member Role, Monthly Earnings Report Feature, No-Online-Payment v1 Model, Public Events Hub Feature, Reservations Feature (+6 more)

### Community 11 - "Auth UI Open Questions"
Cohesion: 0.29
Nodes (7): Brand-Derived Photography Fallback, Continue as Guest State, Auth UI Open Questions (§9), Auth & Onboarding Feature, Idea Plan Open Questions (§9), Auth Screens Implementation (§4,5,7), Decisions Locked In

### Community 12 - "Brand Asset Prep Script"
Cohesion: 0.33
Nodes (6): knockOutWhite(), main(), OUT_DIR, ROOT, SRC_BANNER, SRC_LOGO

### Community 13 - "Light/Dark Theme Tokens"
Cohesion: 0.40
Nodes (6): Light/Back-Office Theme Color Tokens, Theme Flip via .dk-workspace, Border Radius Scale (12-14px app vs 4px --radius-brand workspace), Sharp Workspace vs Soft App Rationale, Staff/Admin Light Workspace Exception, Two Surfaces, One Palette

### Community 14 - "DEKKA Logo Assets"
Cohesion: 0.80
Nodes (5): DEKKA Logo Standard (Design System Asset), DEKKA Logo Square (Design System Asset), DEKKA Logo (Original JPG), DEKKA Logo Standard (Public Brand Asset), DEKKA Logo Square (Public Brand Asset)

### Community 15 - "Next.js Boilerplate Icons"
Cohesion: 0.70
Nodes (5): File Icon, Globe Icon, Next.js Logo, Vercel Logo, Window Icon

### Community 16 - "Button Component"
Cohesion: 0.50
Nodes (4): Button (components/ui/Button.tsx), OutlineButton Component Spec, PrimaryButton Component Spec, Button (components/ui/Button.tsx)

### Community 17 - "PatternAccent Component"
Cohesion: 0.50
Nodes (4): PatternAccent (components/ui/PatternAccent.tsx), دكة Wordmark / Tatreez Motif, PatternAccent Component Spec, PatternAccent (components/ui/PatternAccent.tsx)

### Community 18 - "Color Token Variants"
Cohesion: 0.67
Nodes (3): Shared Accent Color Tokens, Dark Theme Color Tokens, Auth UI Color Tokens

### Community 19 - "Font & Typography Setup"
Cohesion: 0.67
Nodes (3): Cairo / Plus Jakarta Sans Font Families, next/font/google Loading (app/layout.tsx), Auth UI Typography Spec

### Community 20 - "SectionDivider Component"
Cohesion: 0.67
Nodes (3): SectionDivider (components/ui/SectionDivider.tsx), SectionDivider Component Spec, SectionDivider (components/ui/SectionDivider.tsx)

### Community 21 - "TextField Component"
Cohesion: 0.67
Nodes (3): TextField (components/ui/TextField.tsx), TextField Component Spec, TextField / PasswordField / TextAreaField (components/ui/TextField.tsx)

### Community 22 - "Arabic-First Copywriting"
Cohesion: 0.67
Nodes (3): Arabic-First Copywriting Principle, Shipped Copy Examples Table, 'Dekka' = Bench Meaning

### Community 23 - "Coffee Shop Banner Duplicates"
Cohesion: 1.00
Nodes (3): Dekka Coffee Shop Banner (design-system asset), Dekka Coffee Shop Banner (IMGS copy), Dekka Coffee Shop Banner (public brand asset)

### Community 24 - "Auth Screen Layouts"
Cohesion: 1.00
Nodes (3): Desktop Auth Layout (60/40 Split Screen), Mobile Auth Layout (Single Column), AuthScreen (components/auth/AuthScreen.tsx)

## Ambiguous Edges - Review These
- `Desktop Auth Layout (60/40 Split Screen)` → `Mobile Auth Layout (Single Column)`  [AMBIGUOUS]
  PLAN/authorization-UI.md · relation: conceptually_related_to
- `Dekka Product Plan` → `Cafe-Local Timezone Handling`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **207 isolated node(s):** `dynamic`, `dynamic`, `dynamic`, `dynamic`, `dynamic` (+202 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Desktop Auth Layout (60/40 Split Screen)` and `Mobile Auth Layout (Single Column)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Dekka Product Plan` and `Cafe-Local Timezone Handling`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `getI18n()` connect `Admin Event Pages` to `Login & Signup Pages`, `Error & Submission Pages`, `API Route Handlers`, `Public Site Pages`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `useI18n()` connect `Error & Submission Pages` to `Admin Event Pages`, `Public Site Pages`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `connectDB()` connect `API Route Handlers` to `Admin Event Pages`, `Auth & Role Bootstrap`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `dynamic`, `dynamic`, `dynamic` to the rest of the system?**
  _207 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Event Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.07314974182444062 - nodes in this community are weakly interconnected._