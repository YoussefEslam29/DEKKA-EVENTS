/**
 * The browser side of the anonymous counters (`PLAN/DEKKA_PWA_APP.md` §5.4, 4c.1).
 * Client-only. Sends nothing that identifies anyone: a metric name, and for menu views
 * the item ids. Failures are ignored (a refusal in demo mode included): a lost count is
 * never worth an error on screen.
 *
 * Staff and admins aren't counted: the `(site)` layout marks their pages
 * `data-stats-off`, decided on the server, so the beacon itself still learns nothing.
 */
import type { UsageMetric } from "@/lib/constants";

const FLUSH_AT = 50;
const IDLE_FLUSH_MS = 5000;
const sentOnce = new Set<string>();
const viewed = new Set<string>();
let pending: string[] = [];
let idleFlush: ReturnType<typeof setTimeout> | undefined;

function counting(): boolean {
  return typeof document !== "undefined" && !document.querySelector("[data-stats-off]");
}

function send(body: { metric: UsageMetric; items?: string[] }) {
  const json = JSON.stringify(body);
  // sendBeacon is what survives the page going away (a fetch started in `pagehide`, even
  // with `keepalive`, didn't reach the server on a real navigation in testing). Plain
  // text keeps it a "simple" request; the route parses the body as JSON whatever its type.
  try {
    if (navigator.sendBeacon?.("/api/stats", new Blob([json], { type: "text/plain;charset=UTF-8" }))) return;
  } catch {
    // Fall through to fetch.
  }
  fetch("/api/stats", { method: "POST", headers: { "content-type": "application/json" }, body: json, keepalive: true }).catch(() => {});
}

/** A plain tally, at most once per page load. */
export function countOnce(metric: Exclude<UsageMetric, "menu_item_view">) {
  if (!counting() || sentOnce.has(metric)) return;
  sentOnce.add(metric);
  send({ metric });
}

function flush() {
  clearTimeout(idleFlush);
  if (pending.length === 0) return;
  const items = pending;
  pending = [];
  send({ metric: "menu_item_view", items });
}

/** A menu card seen (half on screen for a second), once per item per page load. */
export function countItemView(id: string) {
  if (!counting() || viewed.has(id)) return;
  viewed.add(id);
  pending.push(id);
  if (pending.length >= FLUSH_AT) return flush();
  // Sent once scrolling pauses, while the page is still open: a send started as the page
  // goes away is unreliable (iPhones especially). `pagehide` only catches what's left.
  clearTimeout(idleFlush);
  idleFlush = setTimeout(flush, IDLE_FLUSH_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
