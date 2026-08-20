import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getSubmissions } from "@/lib/data";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/ui/Surface";
import { SubmissionRow } from "@/components/SubmissionRow";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { t } = await getI18n();
  const { status } = await searchParams;
  const active = SUBMISSION_STATUSES.find((s) => s === status) as
    | SubmissionStatus
    | undefined;

  const submissions = await getSubmissions(active);

  const filters: { label: string; value?: SubmissionStatus }[] = [
    { label: t.common.all, value: undefined },
    ...SUBMISSION_STATUSES.map((s) => ({ label: t.submit.status[s], value: s })),
  ];

  return (
    <div>
      <PageHeader title={t.admin.submissions} />

      <div className="mb-5 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/submissions?status=${filter.value}` : "/admin/submissions"}
            className={cn(
              "rounded-[4px] border px-3 py-1.5 text-sm font-semibold transition-colors",
              active === filter.value
                ? "border-ink bg-ink text-cream"
                : "border-line bg-paper text-ink-soft hover:bg-gold-wash"
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {submissions.length === 0 ? (
        <EmptyState>{t.admin.noSubmissions}</EmptyState>
      ) : (
        <div className="grid gap-3">
          {submissions.map((submission) => (
            <SubmissionRow key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
