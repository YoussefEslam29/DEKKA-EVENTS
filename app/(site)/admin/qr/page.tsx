import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { requireRole } from "@/lib/rbac";
import { site } from "@/lib/site";
import { posterUrl, qrPath } from "@/lib/qr";
import { PageHeader } from "@/components/ui/Surface";
import { PrintButton } from "@/components/admin/PrintButton";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.poster.title };
}

export const dynamic = "force-dynamic";

/**
 * The printable table poster (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.2): A4, dark on white for
 * any printer, bilingual so one poster serves every table. The QR always follows
 * `site.url`, so a new domain needs a reprint, not a code change.
 */
export default async function QrPosterPage() {
  // First, before any read: see requireRole() for why the layout's check isn't enough.
  await requireRole("admin", "/admin/qr");
  const { t } = await getI18n();
  const ar = dictionaries.ar.poster;
  const en = dictionaries.en.poster;
  const target = posterUrl(site.url);
  const { size, path } = qrPath(target);
  const shown = `${site.url.replace(/^https?:\/\//, "")}/get-app`;

  return (
    <div>
      {/* Print: A4, the poster alone. The site chrome carries `print:hidden`. */}
      <style>{`@page { size: A4; margin: 12mm; }
@media print { html, body, .dk-workspace { background: #fff !important; } }`}</style>
      <div className="print:hidden">
        <PageHeader title={t.poster.title} subtitle={t.poster.subtitle} action={<PrintButton label={t.poster.print} />} />
      </div>

      <article
        id="qr-poster"
        className="mx-auto flex aspect-[210/297] w-full max-w-[560px] flex-col items-center justify-between rounded-[4px] border border-ink/15 bg-white p-[6%] text-center text-black print:max-w-none print:border-0 print:p-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a print page: the plain file, no optimiser URL */}
        <img src="/brand/dekka-logo-square.png" alt="دكة · Dekka" className="h-[12%] w-auto print:h-[3.2cm]" />
        <div>
          <h1 lang="ar" dir="rtl" className="font-arabic text-[clamp(1.5rem,5vw,2.4rem)] font-black leading-tight print:text-[40pt]">
            {ar.headline}
          </h1>
          <p lang="en" dir="ltr" className="text-[clamp(1.1rem,3.5vw,1.7rem)] font-bold print:text-[24pt]">
            {en.headlineEn}
          </p>
        </div>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="aspect-square w-[62%] print:w-[10cm]"
          shapeRendering="crispEdges"
          role="img"
          aria-label={target}
          data-qr-target={target}
        >
          <rect width={size} height={size} fill="#fff" />
          <path d={path} fill="#000" />
        </svg>
        <div className="grid gap-1 text-sm print:text-[14pt]">
          <p lang="ar" dir="rtl">
            {ar.sub}
          </p>
          <p lang="en" dir="ltr">
            {en.subEn}
          </p>
        </div>
        <ol className="grid w-full grid-cols-3 gap-2 text-xs print:text-[12pt]">
          {[1, 2, 3].map((n) => {
            const key = `step${n}` as "step1" | "step2" | "step3";
            return (
              <li key={n} className="flex flex-col items-center gap-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-sm font-bold text-white">{n}</span>
                <span lang="ar" dir="rtl">
                  {ar[key]}
                </span>
                <span lang="en" dir="ltr">
                  {en[key]}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="grid gap-0.5 text-xs print:text-[11pt]">
          <p lang="ar" dir="rtl">
            {ar.orOpen}
          </p>
          <p lang="en" dir="ltr">
            {en.orOpen}
          </p>
          <p dir="ltr" className="font-mono text-sm font-bold print:text-[13pt]">
            {shown}
          </p>
        </div>
      </article>
    </div>
  );
}
