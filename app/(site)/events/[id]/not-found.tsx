import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { buttonStyles } from "@/components/ui/Button";

export default async function EventNotFound() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-24 text-center md:px-8">
      <p className="text-lg font-semibold">{t.event.notFound}</p>
      <Link href="/" className={`${buttonStyles({ variant: "outline" })} mt-4`}>
        {t.errors.goHome}
      </Link>
    </div>
  );
}
