import { Mail, MapPin, Phone } from "lucide-react";
import { getI18n } from "@/lib/i18n";
import { legalDoc } from "@/lib/legal";
import { site } from "@/lib/site";
import { Card } from "@/components/ui/Surface";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "سياسة الخصوصية — Privacy Policy | Dekka",
};

export default async function PrivacyPage() {
  const { locale, t } = await getI18n();
  const doc = legalDoc("privacy", locale);
  const address = locale === "ar" ? site.addressAr : site.addressEn;

  return (
    <LegalPageLayout {...doc}>
      {/*
       * Who is actually behind the site. Every row is conditional the same way
       * the About page guards `site.phone` — Dekka trades under its own name
       * with no registered company, so `legalEntityName`/`registrationNumber`
       * are blank and simply don't render rather than showing an empty label.
       */}
      <Card className="mt-10 p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-muted">
          {t.legal.businessInfo.heading}
        </h2>
        <p className="font-semibold">
          {t.brand.name} <span lang="en" dir="ltr">({t.brand.latin})</span>
        </p>
        {site.legalEntityName ? (
          <p className="mt-2 text-text-muted">{site.legalEntityName}</p>
        ) : null}
        {site.registrationNumber ? (
          <p className="mt-1 text-text-muted" dir="ltr">
            {site.registrationNumber}
          </p>
        ) : null}
        <p className="mt-3 flex items-start gap-2 text-text-muted">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
          {address}
        </p>
        {site.email ? (
          <p className="mt-3 flex items-start gap-2 text-text-muted">
            <Mail className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
            <a href={`mailto:${site.email}`} dir="ltr" className="hover:underline">
              {site.email}
            </a>
          </p>
        ) : null}
        {site.phone ? (
          <p className="mt-3 flex items-start gap-2 text-text-muted">
            <Phone className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
            <a href={`tel:${site.phone}`} dir="ltr" className="hover:underline">
              {site.phone}
            </a>
          </p>
        ) : null}
      </Card>
    </LegalPageLayout>
  );
}
