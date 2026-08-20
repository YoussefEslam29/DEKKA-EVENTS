import { redirect } from "next/navigation";
import { currentUser, hasRole } from "@/lib/rbac";

/**
 * Authoritative gate for every /staff route. Checking here (rather than only in
 * a proxy) means the guard runs on the server for each render.
 */
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/staff");
  if (!hasRole(user, "staff")) redirect("/");
  return <>{children}</>;
}
