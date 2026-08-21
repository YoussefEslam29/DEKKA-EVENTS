import { getI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/Surface";
import { SubmitShowForm } from "@/components/SubmitShowForm";

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
