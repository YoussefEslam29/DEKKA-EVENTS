import { getI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/Surface";
import { SubmitShowForm } from "@/components/SubmitShowForm";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

/** Its own title and canonical URL (PLAN/SITE_ROADMAP.md D1); the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return pageMetadata({ title: t.submit.title, description: t.submit.subtitle, path: "/submit-show" });
}

export const dynamic = "force-dynamic";

export default async function SubmitShowPage() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">
      <PageHeader title={t.submit.title} subtitle={t.submit.subtitle} />
      <SubmitShowForm />
    </div>
  );
}
