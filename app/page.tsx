import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getPublicEvents, countReservationsForEvents } from "@/lib/data";
import { EventCard } from "@/components/EventCard";
import { Wordmark } from "@/components/Wordmark";
import { EmptyState, TatreezDivider } from "@/components/ui/Surface";
import { buttonStyles } from "@/components/ui/Button";

// The hub reflects reservation counts and admin publishes immediately.
export const dynamic = "force-dynamic";

export default async function EventsHubPage() {
  const { locale, t } = await getI18n();
  const [upcoming, past] = await Promise.all([
    getPublicEvents({ when: "upcoming" }),
    getPublicEvents({ when: "past", limit: 6 }),
  ]);
  const counts = await countReservationsForEvents(upcoming.map((e) => e.id));

  return (
    <div>
      {/* Framed-collage header, echoing the banner treatment in the brand assets. */}
      <section className="border-b border-line bg-paper">
        <TatreezDivider />
        <div className="mx-auto max-w-[1180px] px-4 py-12 text-center md:px-8 md:py-16">
          <Wordmark size="xl" withLatin={false} />
          <p className="mt-4 text-lg font-semibold text-ink">{t.home.heroLine}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-soft">{t.home.heroBody}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="#upcoming" className={buttonStyles({ variant: "primary", size: "lg" })}>
              {t.home.browseEvents}
            </Link>
            <Link href="/submit-show" className={buttonStyles({ variant: "outline", size: "lg" })}>
              {t.home.pitchShow}
            </Link>
          </div>
        </div>
        <TatreezDivider />
      </section>

      <section id="upcoming" className="mx-auto max-w-[1180px] px-4 py-10 md:px-8">
        <h2 className="mb-5 text-xl font-bold tracking-tight md:text-2xl">
          {t.home.upcoming}
        </h2>

        {upcoming.length === 0 ? (
          <EmptyState>{t.home.upcomingEmpty}</EmptyState>
        ) : (
          <div className="grid gap-4">
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                reserved={counts[event.id] ?? 0}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mx-auto max-w-[1180px] px-4 pb-10 md:px-8">
          <h2 className="mb-5 text-xl font-bold tracking-tight text-ink-soft">
            {t.home.past}
          </h2>
          <div className="grid gap-4 opacity-75">
            {past.map((event) => (
              <EventCard key={event.id} event={event} locale={locale} t={t} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
