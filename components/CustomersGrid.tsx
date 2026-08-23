"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { Input, Select } from "@/components/ui/Field";
import { Card, EmptyState } from "@/components/ui/Surface";
import { DataGrid, type GridColumn } from "@/components/ui/DataGrid";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { CheckInDTO, CheckInRowDTO } from "@/lib/data";
import { PAYMENT_METHODS } from "@/lib/constants";

type EventOption = { id: string; title: string };

/**
 * Every attendee across every night, in one spreadsheet
 * (`PLAN/FIX_ADMIN_DASH.md` §2c) — name, phone, how they paid, which show.
 *
 * Filtering is a round trip rather than a client-side `.filter()`: the list is
 * capped server-side, so narrowing it here would only ever search the slice
 * that already came down, and quietly miss older rows.
 */
export function CustomersGrid({
  rows,
  events,
  eventId,
  query,
}: {
  rows: CheckInRowDTO[];
  events: EventOption[];
  eventId: string;
  query: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [data, setData] = useState(rows);
  const [draftQuery, setDraftQuery] = useState(query);

  // The server is the source of truth for the row set; a new filter re-renders
  // this component with fresh `rows`, and this keeps local edits from
  // resurrecting the previous slice.
  const [seed, setSeed] = useState(rows);
  if (seed !== rows) {
    setSeed(rows);
    setData(rows);
  }

  function applyFilters(next: { eventId?: string; q?: string }) {
    const params = new URLSearchParams();
    const event = next.eventId ?? eventId;
    const q = next.q ?? draftQuery;
    if (event) params.set("eventId", event);
    if (q.trim()) params.set("q", q.trim());
    const qs = params.toString();
    router.push(qs ? `/admin/customers?${qs}` : "/admin/customers");
  }

  async function updateRow(id: string, key: string, value: string): Promise<boolean> {
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
    // The PATCH response knows nothing about the joined event columns, so keep
    // the row's existing ones rather than blanking them out.
    setData((current) =>
      current.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
    return true;
  }

  async function deleteRow(row: CheckInRowDTO) {
    const res = await fetch(`/api/checkins/${row.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setData((current) => current.filter((r) => r.id !== row.id));
  }

  const methodOptions = useMemo(
    () =>
      PAYMENT_METHODS.map((method) => ({
        value: method,
        label: method === "cash" ? t.event.cash : t.event.instapay,
      })),
    [t]
  );

  const eventTitle = (row: CheckInRowDTO) =>
    locale === "ar"
      ? row.eventTitleAr || row.eventTitleEn
      : row.eventTitleEn || row.eventTitleAr;

  const columns: GridColumn<CheckInRowDTO>[] = [
    {
      key: "name",
      header: t.staff.name,
      sortable: true,
      editor: { kind: "text", value: (r) => r.name, validate: (v) => v.trim().length > 0 },
      render: (r) => <span className="font-semibold">{r.name}</span>,
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
      sortable: true,
      editor: { kind: "select", value: (r) => r.paymentMethod, options: methodOptions },
      render: (r) => (r.paymentMethod === "cash" ? t.event.cash : t.event.instapay),
    },
    {
      key: "amount",
      header: t.staff.amount,
      align: "end",
      sortable: true,
      sortValue: (r) => r.amount,
      editor: {
        kind: "number",
        min: 0,
        step: "1",
        value: (r) => String(r.amount),
        validate: (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
      },
      render: (r) => <span className="font-semibold">{formatMoney(r.amount, locale)}</span>,
    },
    {
      key: "event",
      header: t.admin.events,
      sortable: true,
      sortValue: (r) => r.eventStartsAt,
      // Read-only: which night someone attended is a fact about the check-in,
      // not a field to retype. Re-assigning it would break the reservation link.
      render: (r) => (
        <Link href={`/admin/events/${r.eventId}`} className="hover:text-gold-deep">
          <span className="block truncate font-semibold">{eventTitle(r) || "—"}</span>
          <span className="dk-muted block text-xs">
            {r.eventStartsAt ? formatShortDate(r.eventStartsAt, locale) : ""}
          </span>
        </Link>
      ),
    },
  ];

  const total = data.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters({});
            }}
          >
            <label htmlFor="customer-search" className="dk-label mb-1.5 block text-sm font-semibold">
              {t.common.search}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 start-2 my-auto h-4 w-4 text-ink-faint" />
              <Input
                id="customer-search"
                className="ps-8"
                placeholder={t.customers.searchPlaceholder}
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
              />
            </div>
          </form>

          <div>
            <label htmlFor="customer-event" className="dk-label mb-1.5 block text-sm font-semibold">
              {t.customers.filterByEvent}
            </label>
            <Select
              id="customer-event"
              value={eventId}
              onChange={(e) => applyFilters({ eventId: e.target.value })}
            >
              <option value="">{t.common.all}</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <p className="dk-muted mt-3 text-xs">
          {t.customers.rowCount.replace("{n}", String(data.length))} ·{" "}
          {t.admin.totalRevenue}: <strong>{formatMoney(total, locale)}</strong> {t.common.egp}
        </p>
      </Card>

      <Card className="overflow-hidden">
        <DataGrid
          rows={data}
          columns={columns}
          rowId={(r) => r.id}
          onCommit={updateRow}
          onDelete={deleteRow}
          empty={
            <div className="p-6">
              <EmptyState>{t.customers.empty}</EmptyState>
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
  );
}
