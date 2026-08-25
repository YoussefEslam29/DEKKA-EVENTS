"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Ticket } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Props = {
  eventId: string;
  /** null when the visitor is browsing as a guest. */
  signedIn: boolean;
  initialCode: string | null;
  reservationId: string | null;
  canReserve: boolean;
  isFull: boolean;
  closed: boolean;
};

/**
 * The one interactive control on an otherwise static event page. Reserving is a
 * single tap; the confirmation state (with the door code) replaces the button
 * in place rather than navigating away.
 */
export function ReserveButton({
  eventId,
  signedIn,
  initialCode,
  reservationId,
  canReserve,
  isFull,
  closed,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(initialCode);
  const [id, setId] = useState<string | null>(reservationId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only alongside a `PHONE_REQUIRED` error — a Google sign-in never
  // collects a phone, but the door list needs one. Drives the inline "add
  // your phone" link so the fix is one tap away, same pattern as
  // AuthForm's EMAIL_TAKEN_OAUTH handling.
  const [phoneRequired, setPhoneRequired] = useState(false);

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=/events/${eventId}`}
        className={buttonStyles({ variant: "gold", size: "lg" })}
      >
        <Ticket className="h-4 w-4" />
        {t.event.loginToReserve}
      </Link>
    );
  }

  async function reserve() {
    setBusy(true);
    setError(null);
    setPhoneRequired(false);
    try {
      const res = await fetch(`/api/events/${eventId}/reservations`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === "EVENT_FULL") setError(t.event.full);
        else if (body.error === "RESERVATIONS_CLOSED") setError(t.event.closed);
        else if (body.error === "PHONE_REQUIRED") {
          setError(t.event.phoneRequired);
          setPhoneRequired(true);
        } else setError(t.common.somethingWrong);
        return;
      }
      setCode(body.data.code);
      setId(body.data.id);
      router.refresh();
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(t.common.somethingWrong);
        return;
      }
      setCode(null);
      setId(null);
      router.refresh();
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  if (code) {
    return (
      <div className="rounded-xl border border-good/30 bg-good/5 p-4">
        <p className="flex items-center gap-2 font-bold text-good">
          <Check className="h-5 w-5" />
          {t.event.reserved}
        </p>
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t.event.yourCode}
          </p>
          <p className="font-mono text-3xl font-black tracking-[0.2em] text-on-dark">{code}</p>
          <p className="mt-1 text-xs text-text-muted">{t.event.codeHint}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 text-bad"
          onClick={cancel}
          disabled={busy}
        >
          {t.event.cancelReservation}
        </Button>
        {error ? <p className="mt-2 text-sm text-bad">{error}</p> : null}
      </div>
    );
  }

  if (closed) {
    return <p className="font-semibold text-warn">{t.event.closed}</p>;
  }
  if (isFull) {
    return <p className="font-semibold text-bad">{t.event.full}</p>;
  }

  return (
    <div>
      <Button variant="gold" size="lg" onClick={reserve} disabled={busy || !canReserve}>
        <Ticket className="h-4 w-4" />
        {busy ? t.event.reserving : t.event.reserve}
      </Button>
      {error ? (
        <div role="alert" className="mt-2 text-sm text-bad">
          <p>{error}</p>
          {/* PHONE_REQUIRED: same pattern as AuthForm's EMAIL_TAKEN_OAUTH —
              the error message plus an actionable control inline, not just
              prose pointing elsewhere. Google sign-in never collects a
              phone, but the door list needs one. */}
          {phoneRequired ? (
            <Link
              href="/account"
              className={cn(buttonStyles({ variant: "outline", size: "sm" }), "mt-2")}
            >
              {t.event.addPhone}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
