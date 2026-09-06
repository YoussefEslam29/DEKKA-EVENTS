import { getI18n } from "@/lib/i18n";
import { legalDoc } from "@/lib/legal";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سياسة الكوكيز — Cookie Policy | Dekka",
};

export default async function CookiesPage() {
  const { locale } = await getI18n();
  return <LegalPageLayout {...legalDoc("cookies", locale)} />;
}
