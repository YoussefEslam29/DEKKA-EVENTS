import { SessionGatedCoffeeLoader } from "@/components/CoffeeLoader";

/**
 * The Suspense fallback for every `(site)` route — the public app and the
 * back-office alike (`PLAN/HOME_PAGE.md` §1).
 *
 * Being nested inside the `(site)` layout, this takes precedence over the root
 * `app/loading.tsx` skeleton, which stays as the fallback for the `(auth)`
 * group. Two files, two jobs.
 *
 * Kept a server component with no logic of its own: everything that has to run
 * in the browser — the session gate, the motion presets — lives inside
 * `SessionGatedCoffeeLoader`.
 */
export default function SiteLoading() {
  return <SessionGatedCoffeeLoader />;
}
