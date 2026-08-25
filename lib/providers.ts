// Shared provider-naming table — no runtime dependencies, safe from a client
// or server component alike (see lib/constants.ts's rule on why this can't
// live in a model file).
//
// Provider-naming policy (settled here once, per the Fix 3 review note, so it
// isn't decided twice): **name the actual provider(s) whenever the calling
// code already has that data at hand.** Both call sites that name a provider
// today — AccountForm.tsx's "signed in with" line and its password-hint, and
// AuthForm.tsx's EMAIL_TAKEN_OAUTH error — already receive the real
// `providers` array (from the session/DB or from the server's error
// `details`), so both name it explicitly rather than falling back to vague
// wording like "a social account". A future call site with the array
// genuinely unavailable is the one place neutral phrasing stays legitimate.
//
// Provider ids are brand names — identical in both languages (§3 typography
// rule: a proper noun renders once, not bilingual-paired) — so this table has
// no ar/en split, unlike everything in lib/i18n/dictionaries.ts.
export const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple",
};

/** Joins provider ids into a display list, e.g. `["google", "facebook"]` →
 * `"Google, Facebook"`. An id with no known label falls back to itself
 * title-cased rather than disappearing silently. */
export function providerNames(providers: string[]): string {
  return providers
    .map((p) => PROVIDER_LABEL[p] ?? p.charAt(0).toUpperCase() + p.slice(1))
    .join(", ");
}
