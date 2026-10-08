import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";
import { AuthScreen } from "@/components/auth/AuthScreen";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

/** Its own title and canonical URL (PLAN/SITE_ROADMAP.md D1); the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata({ title: t.authUi.createAccount, description: t.authUi.createAccountSub, path: "/signup" });
}

export const dynamic = "force-dynamic";

function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await currentUser()) redirect(target);

  return <AuthScreen mode="signup" next={target} />;
}
