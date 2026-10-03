import { getMenu } from "@/lib/data";
import { FadeUp } from "@/components/ui/Motion";
import { MenuManager } from "@/components/menu/admin/MenuManager";

export const dynamic = "force-dynamic";

/**
 * Menu management (`PLAN/DEKKA_PWA_APP.md` §3). Admin-only through
 * `app/(site)/admin/layout.tsx`, the one gate for this route group.
 *
 * Reads with `includeHidden` server-side — hidden and empty sections included —
 * rather than through `GET /api/menu`, which must stay identical for every
 * caller because the service worker caches it.
 */
export default async function AdminMenuPage() {
  const categories = await getMenu({ includeHidden: true });

  return (
    <FadeUp>
      <MenuManager initial={categories} />
    </FadeUp>
  );
}
