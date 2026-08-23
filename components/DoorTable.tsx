"use client";

import { useMemo, useState } from "react";
import { UserPlus, Search } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Card, Badge, EmptyState } from "@/components/ui/Surface";
import { Stagger, StaggerItem } from "@/components/ui/Motion";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { formatMoney, formatTime } from "@/lib/format";
import type { CheckInDTO, ReservationDTO } from "@/lib/data";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/constants";

type Props = {
  eventId: string;
  defaultPrice: number;
  paymentMethods: PaymentMethod[];
  initialReservations: ReservationDTO[];
  initialCheckIns: CheckInDTO[];
};

/**
 * The door, on event night. Optimised for one thing: typing a name and a phone
 * number fast while someone waits. State is held locally and appended on
 * success so the table never blanks out between entries.
 *
 * The quick-entry form on the side is deliberately kept as-is
 * (`PLAN/FIX_ADMIN_DASH.md` §2b) — muscle memory at a busy door beats a
 * spreadsheet-first flow. What changed is the table beside it: it is now the
 * shared `DataGrid`, so a mistyped digit is a click and a retype instead of a
 * delete and a re-add.
 */
export function DoorTable({
  eventId,
  defaultPrice,
  paymentMethods,
  initialReservations,
  initialCheckIns,
}: Props) {
  const { t, locale } = useI18n();
  const [checkIns, setCheckIns] = useState<CheckInDTO[]>(initialCheckIns);
  const [reservations, setReservations] = useState<ReservationDTO[]>(initialReservations);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    paymentMethod: paymentMethods[0] ?? "cash",
    amount: String(defaultPrice),
    reservationId: "",
  });

  const totals = useMemo(() => {
    const sum = checkIns.reduce((acc, c) => acc + c.amount, 0);
    const cash = checkIns
      .filter((c) => c.paymentMethod === "cash")
      .reduce((acc, c) => acc + c.amount, 0);
    return { sum, cash, instapay: sum - cash, count: checkIns.length };
  }, [checkIns]);

  const filteredReservations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.code.toLowerCase().includes(q)
    );
  }, [reservations, query]);

  /** Clicking a reservation drops its details into the entry form. */
  function prefill(reservation: ReservationDTO) {
    setForm((f) => ({
      ...f,
      name: reservation.name,
      phone: reservation.phone,
      reservationId: reservation.id,
      amount: String(defaultPrice),
    }));
  }

  async function addAttendee(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          paymentMethod: form.paymentMethod,
          amount: Number(form.amount) || 0,
          reservationId: form.reservationId || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error === "ALREADY_CHECKED_IN" ? t.staff.checkedIn : t.common.somethingWrong);
        return;
      }

      setCheckIns((rows) => [body.data as CheckInDTO, ...rows]);
      if (form.reservationId) {
        setReservations((rows) =>
          rows.map((r) => (r.id === form.reservationId ? { ...r, checkedIn: true } : r))
        );
      }
      setForm({
        name: "",
        phone: "",
        paymentMethod: form.paymentMethod,
        amount: String(defaultPrice),
        reservationId: "",
      });
    } catch {
      setError(t.common.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  async function removeCheckIn(checkIn: CheckInDTO) {
    setBusy(true);
    try {
      const res = await fetch(`/api/checkins/${checkIn.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(t.common.somethingWrong);
        return;
      }
      setCheckIns((rows) => rows.filter((r) => r.id !== checkIn.id));
      if (checkIn.reservationId) {
        setReservations((rows) =>
          rows.map((r) => (r.id === checkIn.reservationId ? { ...r, checkedIn: false } : r))
        );
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * One committed cell → one PATCH. Local state is updated from the server's
   * response rather than from the typed string, so trimming and coercion done
   * by the schema are what end up on screen.
   */
  async function updateCheckIn(id: string, key: string, value: string): Promise<boolean> {
    // Kept as an index signature rather than a union of literal shapes so the
    // one branch that coerces (amount) doesn't have to be typed three ways.
    const patch: Record<string, string | number> =
      key === "amount" ? { amount: Number(value) } : { [key]: value };

    if (key === "amount" && !Number.isFinite(patch.amount)) return false;

    const res = await fetch(`/api/checkins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return false;

    const body = await res.json();
    const updated = body.data as CheckInDTO;
    setCheckIns((rows) => rows.map((r) => (r.id === id ? updated : r)));
    return true;
  }

  const methodOptions = useMemo(
    () =>
      // Fall back to the full enum if the event somehow lists none, so an old
      // row's method is still selectable rather than silently unset.
      (paymentMethods.length ? paymentMethods : [...PAYMENT_METHODS]).map((method) => ({
        value: method,
        label: method === "cash" ? t.event.cash : t.event.instapay,
      })),
    [paymentMethods, t]
  );

  const columns: GridColumn<CheckInDTO>[] = [
    {
      key: "name",
      header: t.staff.name,
      editor: { kind: "text", value: (r) => r.name, validate: (v) => v.trim().length > 0 },
      render: (r) => (
        <span className="font-semibold">
          {r.name}
          <span className="dk-muted ms-2 text-xs font-normal">
            {formatTime(r.createdAt, locale)}
          </span>
        </span>
      ),
    },
    {
      key: "phone",
      header: t.staff.phone,
      editor: { kind: "tel", value: (r) => r.phone, validate: (v) => v.trim().length >= 4 },
      render: (r) => <span dir="ltr">{r.phone}</span>,
    },
    {
      key: "paymentMethod",
      header: t.staff.method,
      editor: { kind: "select", value: (r) => r.paymentMethod, options: methodOptions },
      render: (r) => (r.paymentMethod === "cash" ? t.event.cash : t.event.instapay),
    },
    {
      key: "amount",
      header: t.staff.amount,
      align: "end",
      editor: {
        kind: "number",
        min: 0,
        step: "1",
        value: (r) => String(r.amount),
        validate: (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
      },
      render: (r) => <span className="font-semibold">{formatMoney(r.amount, locale)}</span>,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-6">
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <UserPlus className="h-4 w-4 text-gold-deep" />
            {t.staff.addAttendee}
          </h2>
          <form onSubmit={addAttendee}>
            <FormRow label={t.staff.name} htmlFor="attendee-name">
              <Input
                id="attendee-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoComplete="off"
              />
            </FormRow>
            <FormRow label={t.staff.phone} htmlFor="attendee-phone">
              <Input
                id="attendee-phone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
                autoComplete="off"
              />
            </FormRow>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label={t.staff.method} htmlFor="attendee-method">
                <Select
                  id="attendee-method"
                  value={form.paymentMethod}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMethod: e.target.value as PaymentMethod,
                    }))
                  }
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method === "cash" ? t.event.cash : t.event.instapay}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label={t.staff.amount} htmlFor="attendee-amount">
                <Input
                  id="attendee-amount"
                  type="number"
                  min={0}
                  step="1"
                  dir="ltr"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </FormRow>
            </div>

            {form.reservationId ? (
              <p className="mb-3 text-xs font-semibold text-good">
                {t.staff.reservationList} ✓
              </p>
            ) : null}
            {error ? <p className="mb-3 text-sm font-semibold text-bad">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t.staff.adding : t.staff.add}
            </Button>
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-bold">{t.staff.reservationList}</h2>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute inset-y-0 start-2 my-auto h-4 w-4 text-ink-faint" />
            <Input
              className="ps-8"
              placeholder={t.staff.searchReservations}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <ul className="max-h-96 space-y-1 overflow-y-auto">
            {filteredReservations.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => prefill(r)}
                  disabled={r.checkedIn}
                  className="flex w-full items-center justify-between gap-2 rounded-[4px] px-2 py-2 text-start hover:bg-gold-wash disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block text-xs text-ink-faint" dir="ltr">
                      {r.phone} · {r.code}
                    </span>
                  </span>
                  {r.checkedIn ? (
                    <Badge tone="good">{t.staff.checkedIn}</Badge>
                  ) : (
                    <Badge tone="gold">{t.staff.checkIn}</Badge>
                  )}
                </button>
              </li>
            ))}
            {filteredReservations.length === 0 ? (
              <li className="px-2 py-4 text-sm text-ink-faint">{t.common.none}</li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div>
        <Stagger className="mb-4 grid grid-cols-3 gap-3">
          <StaggerItem>
            <Card className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {t.staff.count}
              </p>
              <p className="text-2xl font-black">{totals.count}</p>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {t.staff.total}
              </p>
              <p className="text-2xl font-black text-gold-deep">
                {formatMoney(totals.sum, locale)}
              </p>
            </Card>
          </StaggerItem>
          <StaggerItem>
            <Card className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                {t.event.cash} / {t.event.instapay}
              </p>
              <p className="text-sm font-bold" dir="ltr">
                {formatMoney(totals.cash, locale)} / {formatMoney(totals.instapay, locale)}
              </p>
            </Card>
          </StaggerItem>
        </Stagger>

        <Card className="overflow-hidden">
          <div className="dk-hairline flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-bold">{t.staff.attendees}</h2>
            <p className="dk-muted text-xs">{t.grid.editHint}</p>
          </div>
          <DataGrid
            rows={checkIns}
            columns={columns}
            rowId={(r) => r.id}
            onCommit={updateCheckIn}
            onDelete={removeCheckIn}
            empty={
              <div className="p-6">
                <EmptyState>{t.staff.noAttendees}</EmptyState>
              </div>
            }
            labels={{
              delete: t.staff.remove,
              saving: t.common.saving,
              error: t.grid.saveFailed,
              editHint: t.grid.editHint,
            }}
          />
        </Card>
      </div>
    </div>
  );
}
