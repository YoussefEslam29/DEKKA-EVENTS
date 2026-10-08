// The door log's write side (`PLAN/SITE_ROADMAP.md` I3). Called by the three check-in
// routes after their write has succeeded.
import * as Sentry from "@sentry/nextjs";
import { CheckInAudit, type AuditChange } from "@/models/CheckInAudit";
import type { CheckInAuditAction } from "@/lib/constants";
import type { SessionUser } from "@/lib/rbac";

/** The door-row fields a person types, and so the only ones the log describes. */
export const AUDITED_FIELDS = ["name", "phone", "paymentMethod", "amount", "gender", "note"] as const;
type AuditedField = (typeof AUDITED_FIELDS)[number];
type AuditedRow = Partial<Record<AuditedField, unknown>>;

const normalise = (value: unknown) => (value === undefined || value === "" ? null : value);

/**
 * What an edit actually changed, field by field. Fields the patch didn't carry, and
 * fields it carried with the value they already had, are left out, so re-saving a cell
 * unchanged never shows up as an edit.
 */
export function diffCheckIn(before: AuditedRow, patch: AuditedRow): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of AUDITED_FIELDS) {
    if (!(field in patch)) continue;
    const from = normalise(before[field]);
    const to = normalise(patch[field]);
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

/** A whole row as changes from nothing (a check-in) or to nothing (a removal). */
export function snapshotCheckIn(row: AuditedRow, direction: "in" | "out"): AuditChange[] {
  return AUDITED_FIELDS.filter((field) => normalise(row[field]) !== null).map((field) =>
    direction === "in"
      ? { field, from: null, to: row[field] }
      : { field, from: row[field], to: null }
  );
}

/**
 * Appends one entry. Never throws: the door is busy and the cash has already changed hands,
 * so a log write failing must not turn a recorded check-in into an error at the door. It
 * reports to Sentry instead, so a silent gap in the log is not also an unseen one.
 */
export async function recordCheckInAudit(entry: {
  checkIn: string;
  event: string;
  action: CheckInAuditAction;
  user: SessionUser;
  changes: AuditChange[];
}): Promise<void> {
  if (entry.action === "update" && entry.changes.length === 0) return;
  try {
    await CheckInAudit.create({
      checkIn: entry.checkIn,
      event: entry.event,
      action: entry.action,
      by: entry.user.id,
      byName: entry.user.name ?? entry.user.email ?? "",
      changes: entry.changes,
    });
  } catch (error) {
    console.error("[checkin-audit] write failed", error);
    Sentry.captureException(error, { tags: { stage: "checkin-audit", action: entry.action } });
  }
}
