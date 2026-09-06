import { getI18n } from "@/lib/i18n";
import { legalDoc } from "@/lib/legal";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سياسة الحجز والاسترداد — Reservation & Refund Policy | Dekka",
};

export default async function RefundPolicyPage() {
  const { locale } = await getI18n();
  return <LegalPageLayout {...legalDoc("refundPolicy", locale)} />;
}
