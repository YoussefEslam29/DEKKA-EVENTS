import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, MapPin, Wallet, DoorOpen, ExternalLink } from "lucide-react";
import { getI18n, fill } from "@/lib/i18n";
import { currentUser, hasRole } from "@/lib/rbac";
import {
  getEvent,
  countReservations,
  getMyReservation,
  eventTitle,
  eventText,
} from "@/lib/data";
import { formatDate, formatTime, formatMoney, formatNumber } from "@/lib/format";
import { Card, Badge, TatreezDivider } from "@/components/ui/Surface";
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

  const facts = [
    { Icon: CalendarDays, label: t.event.date, value: formatDate(event.startsAt, locale) },
    { Icon: Clock, label: t.event.time, value: formatTime(event.startsAt, locale) },
    ...(event.doorsOpenAt
      ? [{ Icon: DoorOpen, label: t.event.doors, value: formatTime(event.doorsOpenAt, locale) }]
      : []),
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

  return (
    <article>
      {event.coverImage ? (
        <div className="relative h-56 w-full md:h-80">
          <Image
            src={event.coverImage}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      ) : (
        <div className="dk-tatreez-field h-24 w-full border-b border-line bg-paper" />
      )}

      <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
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

        <h1 className="text-3xl font-black tracking-tight md:text-4xl">
          {eventTitle(event, locale)}
        </h1>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div>
            {description ? (
              <p className="whitespace-pre-line text-base leading-relaxed text-ink-soft">
                {description}
              </p>
            ) : null}

            <TatreezDivider className="my-6" />

            <dl className="grid gap-4 sm:grid-cols-2">
              {facts.map(({ Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold-deep" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      {label}
                    </dt>
                    <dd className="font-semibold">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <Card className="mt-6 p-4">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
                {t.event.payment}
              </h2>
              <p className="font-semibold">{t.event.payAtDoor}</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {event.paymentMethods.includes("cash") ? <li>• {t.event.cash}</li> : null}
                {event.paymentMethods.includes("instapay") ? (
                  <li>
                    • {t.event.instapay}
                    {event.instapayNumber ? (
                      <span className="ms-2 font-mono font-semibold text-ink">
                        {event.instapayNumber}
                      </span>
                    ) : null}
                  </li>
                ) : null}
              </ul>
            </Card>

            {terms ? (
              <Card className="mt-4 p-4">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-faint">
                  {t.event.terms}
                </h2>
                <p className="whitespace-pre-line text-sm text-ink-soft">{terms}</p>
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

              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gold-deep hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                {t.event.directions}
              </a>

              {hasRole(user, "admin") ? (
                <p className="mt-4 border-t border-line pt-3 text-sm text-ink-soft">
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
