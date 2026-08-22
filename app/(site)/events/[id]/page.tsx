import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Wallet, ExternalLink } from "lucide-react";
import { getI18n, fill } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";
import {
  getEvent,
  countReservations,
  getMyReservation,
  eventText,
} from "@/lib/data";
import { formatDate, formatTime, formatMoney, formatNumber } from "@/lib/format";
import { Card, Badge } from "@/components/ui/Surface";
import { PatternAccent } from "@/components/ui/PatternAccent";
import { ReserveButton } from "@/components/ReserveButton";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n();
  const event = await getEvent(id);
  if (!event) notFound();

  const user = await currentUser();
  // Drafts stay invisible to everyone but the admin previewing them.
  if (event.status === "draft" && !hasRole(user, "admin")) notFound();

  const [reserved, myReservation] = await Promise.all([
    countReservations(event.id),
    user ? getMyReservation(event.id, user.id) : Promise.resolve(null),
  ]);

  const spotsLeft =
    event.capacity != null ? Math.max(event.capacity - reserved, 0) : null;
  const isFull = spotsLeft === 0;
  const isPast = event.isPast;
  const closed = event.status !== "published" || isPast;

  const description = eventText(event, locale, "description");
  const location = eventText(event, locale, "location");
  const terms = eventText(event, locale, "terms");
  const mapUrl = event.mapUrl || site.maps;
  // Almost every event still uses the cafe's own default map link (see §1)
  // — embed the known-good cafe coordinates instead of just linking out.
  const isCafeLocation = !event.mapUrl || event.mapUrl === site.maps;

  const facts = [
    { Icon: CalendarDays, label: t.event.date, value: formatDate(event.startsAt, locale) },
    { Icon: Clock, label: t.event.time, value: formatTime(event.startsAt, locale) },
    ...(location ? [{ Icon: MapPin, label: t.event.location, value: location }] : []),
    {
      Icon: Wallet,
      label: t.event.price,
      value:
        event.price > 0
          ? `${formatMoney(event.price, locale)} ${t.common.egp}`
          : t.common.free,
    },
  ];

  // Poster mode still needs a real <h1> for a11y/SEO/tab title — it just
  // isn't drawn over the artwork like a photo hero's overlay text is.
  const heroHeading = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={event.status === "published" ? "good" : "neutral"}>
          {t.event.status[event.status]}
        </Badge>
        {spotsLeft != null && !closed ? (
          <Badge tone={isFull ? "bad" : "gold"}>
            {isFull ? t.event.full : fill(t.event.spotsLeft, { n: formatNumber(spotsLeft, locale) })}
          </Badge>
        ) : null}
        {spotsLeft == null && !closed ? (
          <Badge tone="neutral">{t.event.unlimited}</Badge>
        ) : null}
      </div>

      <h1
        lang="en"
        dir="ltr"
        className="max-w-3xl text-3xl font-extrabold leading-tight text-cream md:text-5xl"
      >
        {event.titleEn || event.titleAr}
      </h1>
      {event.titleAr && event.titleAr !== event.titleEn ? (
        <p className="mt-2 max-w-3xl text-lg font-light text-cream/70 md:text-xl">
          <span lang="ar" dir="rtl" className="font-arabic">
            {event.titleAr}
          </span>
        </p>
      ) : null}
    </>
  );

  return (
    <article>
      {/*
       * §8: the event hero gets the same treatment as the auth left panel —
       * dark image, gradient, bold English headline with the Arabic beneath —
       * only showing the event's own artwork instead of the cafe interior.
       * A poster cover image is the exception: it already carries its own
       * title/date, so it renders as pure artwork with no overlay (§2c).
       */}
      <section className="relative isolate flex min-h-[16rem] items-end overflow-hidden border-b border-border-dark md:min-h-[22rem]">
        {event.coverImage ? (
          <Image
            src={event.coverImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-coffee">
            <div className="absolute inset-0 bg-[radial-gradient(65%_50%_at_25%_10%,rgba(217,165,102,0.32)_0%,transparent_70%)]" />
            <PatternAccent variant="field" className="absolute inset-0" />
          </div>
        )}

        {event.coverImage && event.isPoster ? null : (
          <>
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(24,18,13,0.96)_0%,rgba(24,18,13,0.72)_45%,rgba(24,18,13,0.3)_100%)]"
            />
            <div className="relative mx-auto w-full max-w-[1180px] px-4 pb-8 pt-16 md:px-8">
              {heroHeading}
            </div>
          </>
        )}
      </section>

      <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-8">
        {event.coverImage && event.isPoster ? (
          <div className="mb-6">{heroHeading}</div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
            {description ? (
              <p className="whitespace-pre-line text-base leading-relaxed text-text-muted">
                {description}
              </p>
            ) : null}

            <PatternAccent className="my-6" />

            <dl className="grid gap-4 sm:grid-cols-2">
              {facts.map(({ Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold-accent" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                      {label}
                    </dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <Card className="mt-6 p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-text-muted">
                {t.event.payment}
              </h2>
              <p className="font-semibold">{t.event.payAtDoor}</p>
              <ul className="mt-2 space-y-1 text-sm text-text-muted">
                {event.paymentMethods.includes("cash") ? <li>• {t.event.cash}</li> : null}
                {event.paymentMethods.includes("instapay") ? (
                  <li>
                    • {t.event.instapay}
                    {event.instapayNumber ? (
                      <span className="ms-2 font-mono font-semibold text-on-dark">
                        {event.instapayNumber}
                      </span>
                    ) : null}
                  </li>
                ) : null}
              </ul>
            </Card>

            {terms ? (
              <Card className="mt-4 p-4">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-text-muted">
                  {t.event.terms}
                </h2>
                <p className="whitespace-pre-line text-sm text-text-muted">{terms}</p>
              </Card>
            ) : null}
          </div>

          {/* Reserve panel sticks alongside the details on desktop. */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card className="p-4">
              <ReserveButton
                eventId={event.id}
                signedIn={Boolean(user)}
                initialCode={myReservation?.code ?? null}
                reservationId={myReservation?.id ?? null}
                canReserve={!closed && !isFull}
                isFull={isFull}
                closed={closed}
              />

              {isCafeLocation ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-border-dark">
                  <iframe
                    src={site.mapsEmbed}
                    title="Dekka on Google Maps"
                    className="h-48 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-accent hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t.event.directions}
                </a>
              )}

              {hasRole(user, "admin") ? (
                <p className="mt-4 border-t border-border-dark pt-3 text-sm text-text-muted">
                  {t.event.reservedCount}: <strong>{reserved}</strong>
                </p>
              ) : null}
            </Card>
          </aside>
        </div>
      </div>
    </article>
  );
}
