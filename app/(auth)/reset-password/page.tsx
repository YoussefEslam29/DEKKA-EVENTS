import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";
import { emailEnabled } from "@/lib/email";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

/** Its own title and canonical URL (PLAN/SITE_ROADMAP.md D1); the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata({ title: t.authUi.resetTitle, path: "/reset-password", noindex: true });
}

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await currentUser()) redirect("/account");
  if (!emailEnabled) redirect("/login");

  const { token } = await searchParams;

  // No token means someone reached this URL without following a link. Send them to
  // request one rather than rendering a form that cannot possibly succeed.
  if (!token) redirect("/forgot-password");

  // Deliberately *not* validated here beyond presence. Checking whether the token is
  // real would mean a database lookup that leaks, by page behaviour, whether a given
  // token exists — the form's single "invalid or expired" response is the only signal
  // anyone gets.
  return (
    <AuthScreen mode="login" next="/">
      <ResetPasswordForm token={token} />
    </AuthScreen>
  );
}
