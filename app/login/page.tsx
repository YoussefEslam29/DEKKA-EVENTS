import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { currentUser } from "@/lib/rbac";
import { enabledOAuthProviders } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Wordmark } from "@/components/Wordmark";
import { Card } from "@/components/ui/Surface";

export const dynamic = "force-dynamic";

/** Only same-origin paths are honoured, so `?next=` can't bounce people offsite. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { t } = await getI18n();
  const { next } = await searchParams;
  const target = safeNext(next);

  if (await currentUser()) redirect(target);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-6 text-center">
        <Wordmark size="lg" />
        <h1 className="mt-5 text-2xl font-bold">{t.auth.loginTitle}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t.auth.loginSubtitle}</p>
      </div>
      <Card className="p-6">
        <AuthForm mode="login" next={target} providers={enabledOAuthProviders} />
      </Card>
    </div>
  );
}
