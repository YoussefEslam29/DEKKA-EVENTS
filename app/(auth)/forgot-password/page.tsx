import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";
import { emailEnabled } from "@/lib/email";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  // Already signed in? There is nothing to recover — /account is where a signed-in
  // member changes their password.
  if (await currentUser()) redirect("/account");

  // Without a mail provider this flow cannot deliver anything, so the page does not
  // exist rather than accepting an address and silently dropping it. The link into
  // here is hidden on the same condition, so this is defence in depth for a
  // hand-typed URL.
  if (!emailEnabled) redirect("/login");

  return (
    <AuthScreen mode="login" next="/">
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
