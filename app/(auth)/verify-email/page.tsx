import { redirect } from "next/navigation";
import { emailEnabled } from "@/lib/email";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { VerifyEmailForm } from "@/components/VerifyEmailForm";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

/** Its own title and canonical URL (PLAN/SITE_ROADMAP.md D1); the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata({ title: t.authUi.verifyTitle, path: "/verify-email", noindex: true });
}

export const dynamic = "force-dynamic";

/**
 * Where the verification email's link lands (`PLAN/SITE_ROADMAP.md` S3). Works signed in or
 * out: the token is the proof, not the session. The page itself changes nothing. The
 * form POSTs the token from the browser, so a mail scanner that pre-fetches the link to
 * check it for malware doesn't spend it.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!emailEnabled) redirect("/login");
  const { token } = await searchParams;
  if (!token) redirect("/account");

  return (
    <AuthScreen mode="login" next="/">
      <VerifyEmailForm token={token} />
    </AuthScreen>
  );
}
