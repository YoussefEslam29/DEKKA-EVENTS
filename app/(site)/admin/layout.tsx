import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Inbox, BarChart3, LayoutDashboard, Users } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (!hasRole(user, "admin")) redirect("/");

  const { t } = await getI18n();
  const links = [
    { href: "/admin", label: t.admin.overview, Icon: LayoutDashboard },
    { href: "/admin/events", label: t.admin.events, Icon: CalendarDays },
    { href: "/admin/customers", label: t.customers.title, Icon: Users },
    { href: "/admin/submissions", label: t.admin.submissions, Icon: Inbox },
    { href: "/admin/report", label: t.admin.report, Icon: BarChart3 },
  ];

  return (
    // §8 exception: cream workspace for the data-heavy back-office. The tint is
    // full-bleed so it doesn't leave dark gutters beside the centred column.
    <div className="dk-workspace min-h-full flex-1">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-8 md:flex-row md:px-8">
      <aside className="md:w-52 md:shrink-0">
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {links.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-[4px] px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-gold-wash hover:text-ink"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
