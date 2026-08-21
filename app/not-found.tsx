import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { buttonStyles } from "@/components/ui/Button";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-24 text-center md:px-8">
      <p className="text-6xl font-black text-gold-accent">404</p>
      <p className="mt-3 text-lg font-semibold">{t.errors.notFound}</p>
      <Link href="/" className={`${buttonStyles({ variant: "outline" })} mt-5`}>
        {t.errors.goHome}
      </Link>
    </div>
  );
}
