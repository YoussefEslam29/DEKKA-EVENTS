/**
 * The door table's offline queue (`PLAN/SITE_ROADMAP.md` R3). Client-safe and pure: the
 * storage is passed in, so `scripts/check-door.ts` can drive it without a browser.
 *
 * Why: the cafe's Wi-Fi on a packed night is exactly when a request fails, and a failed
 * add used to mean an error and a retyped entry. Now every entry is saved on the phone
 * first and sent after, retried until the server has it. Each carries a `clientId` the
 * server stores with a unique index, so sending the same entry twice (a retry after a
 * timeout that actually succeeded) records it once.
 *
 * localStorage, not IndexedDB: a night's queue is a few kilobytes and synchronous access
 * keeps the code obvious. It only ever holds entries not yet on the server.
 */
import type { Gender, PaymentMethod } from "@/lib/constants";

export type CheckInPayload = {
  clientId: string;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
  amount: number;
  gender?: Gender;
  reservationId?: string;
};

export type QueuedCheckIn = {
  clientId: string;
  payload: CheckInPayload;
  createdAt: string;
  /** Set when the server refused the entry (a 4xx): it stays visible, with the reason. */
  error?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const queueKey = (eventId: string) => `dekka_door_queue:${eventId}`;

/** One night's pending entries. Corrupt or unreadable storage reads as empty, never throws. */
export function readQueue(storage: StorageLike | null, eventId: string): QueuedCheckIn[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(queueKey(eventId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedCheckIn =>
        typeof item?.clientId === "string" &&
        typeof item?.payload?.name === "string" &&
        typeof item?.payload?.amount === "number"
    );
  } catch {
    return [];
  }
}

/** Saves one night's queue; an empty queue removes the key. Storage failures are swallowed. */
export function writeQueue(storage: StorageLike | null, eventId: string, items: QueuedCheckIn[]): void {
  if (!storage) return;
  try {
    if (items.length === 0) storage.removeItem(queueKey(eventId));
    else storage.setItem(queueKey(eventId), JSON.stringify(items));
  } catch {
    // Private mode or a full quota: the entry still sits in memory and is still sent.
  }
}

export type SendOutcome = "synced" | "retry" | "rejected";

/**
 * What one send attempt means for a queued entry:
 * - the server has it (2xx, including the idempotent replay of an entry it already had);
 * - try again later: no connection, a timeout, rate limited, or the server erroring;
 * - the server refused it (any other 4xx): retrying would only be refused again, so it
 *   waits for a person to read the reason and remove it.
 */
export function outcomeFor(status: number | "network"): SendOutcome {
  if (status === "network") return "retry";
  if (status >= 200 && status < 300) return "synced";
  if (status === 429 || status === 408 || status >= 500) return "retry";
  return "rejected";
}

/** A fresh id for one entry. `crypto.randomUUID` exists in every browser that runs the app. */
export function newClientId(): string {
  return crypto.randomUUID();
}

/** The shape `checkInSchema.clientId` accepts. */
export const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
