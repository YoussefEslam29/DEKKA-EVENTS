import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser, hasRole } from "@/lib/rbac";

/**
 * Authoritative gate for every /staff route. Checking here (rather than only in
 * a proxy) means the guard runs on the server for each render.
 */
/** Never indexed (also X-Robots-Tag in next.config.ts and Disallow in robots.ts). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/staff");
  if (!hasRole(user, "staff")) redirect("/");
  // §8 exception: the door tool stays on the high-contrast cream workspace,
  // which is faster and less error-prone for counter-side data entry.
  return <div className="dk-workspace min-h-full flex-1">{children}</div>;
}
