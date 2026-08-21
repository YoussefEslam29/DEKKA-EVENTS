import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { getPublicEvents, countReservationsForEvents } from "@/lib/data";
import { EventCard } from "@/components/EventCard";
import { LogoBadge } from "@/components/ui/LogoBadge";
import { EmptyState } from "@/components/ui/Surface";
import { PatternAccent } from "@/components/ui/PatternAccent";
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
      <section className="border-b border-border-dark bg-surface-dark">
        <PatternAccent />
        <div className="mx-auto max-w-[1180px] px-4 py-12 text-center md:px-8 md:py-16">
          <LogoBadge size="xl" tagline priority />
          <p className="mt-4 text-lg font-semibold text-on-dark">{t.home.heroLine}</p>
          <p className="mx-auto mt-3 max-w-xl text-sm text-text-muted">{t.home.heroBody}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="#upcoming" className={buttonStyles({ variant: "gold", size: "lg" })}>
              {t.home.browseEvents}
            </Link>
            <Link href="/submit-show" className={buttonStyles({ variant: "outline", size: "lg" })}>
              {t.home.pitchShow}
            </Link>
          </div>
        </div>
        <PatternAccent />
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
        <section className="mx-auto max-w-[1180px] px-4 pb-16 md:px-8">
          <h2 className="mb-5 text-xl font-bold tracking-tight text-text-muted">
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
