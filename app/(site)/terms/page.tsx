import { getI18n } from "@/lib/i18n";
import { legalDoc } from "@/lib/legal";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الشروط والأحكام — Terms & Conditions | Dekka",
};

export default async function TermsPage() {
  const { locale } = await getI18n();
  return <LegalPageLayout {...legalDoc("terms", locale)} />;
}
