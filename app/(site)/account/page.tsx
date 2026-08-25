import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { currentUser } from "@/lib/rbac";
import { getAccountUser } from "@/lib/data";
import { PageHeader } from "@/components/ui/Surface";
import { FadeUp } from "@/components/ui/Motion";
import { AccountForm } from "@/components/AccountForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { t } = await getI18n();
  const user = await currentUser();
  if (!user) redirect("/login?next=/account");

  const account = await getAccountUser(user.id);
  // The session outlived its own user document (e.g. deleted directly in the
  // database) — same dead-end-safe redirect as the signed-out case.
  if (!account) redirect("/login?next=/account");

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8">
      <FadeUp>
        <PageHeader title={t.account.title} subtitle={t.account.subtitle} />
      </FadeUp>
      <AccountForm account={account} />
    </div>
  );
}
