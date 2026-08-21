import { redirect } from "next/navigation";
import { currentUser } from "@/lib/rbac";
import { AuthScreen } from "@/components/auth/AuthScreen";

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
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await currentUser()) redirect(target);

  return <AuthScreen mode="login" next={target} />;
}
