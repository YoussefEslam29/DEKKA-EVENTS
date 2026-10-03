import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Smartphone } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { currentUser } from "@/lib/rbac";
import { getAccountUser } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui/Surface";
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
      {/* Browser only — inside the installed app there is nothing left to get. */}
      <Link href="/get-app" className="mt-4 block standalone:hidden">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-accent/10 text-gold-accent">
            <Smartphone className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{t.app.install.getApp}</p>
            <p className="text-sm text-text-muted">{t.app.install.body}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-text-muted rtl:rotate-180" aria-hidden />
        </Card>
      </Link>
    </div>
  );
}
