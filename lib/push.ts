// Web push, server side (`PLAN/LOG_SIGN_AUTH_IN.md` §6, hardened by `PLAN/SITE_ROADMAP.md`
// S5). One place that knows which endpoints are real push services and how to fan a
// message out to many devices without one bad device, or a flood of fake ones, taking the
// caller down with it.
import webpush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { PushSubscription, type IPushSubscription } from "@/models/PushSubscription";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

/** Push works only with all three set; `setVapidDetails` throws on a blank or malformed one. */
export const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
if (pushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

/**
 * The push services browsers actually hand out endpoints for. A subscription's endpoint
 * is a URL the *server* later POSTs to on every publish, so accepting any URL let a
 * signed-in member point it at any HTTPS host (a blind SSRF) and register thousands of
 * fakes that the publish request then had to wait for.
 * Exact hosts, plus suffixes that start with a dot (Mozilla and Windows shard by host).
 */
export const PUSH_HOST_ALLOWLIST = [
  "fcm.googleapis.com", // Chrome, Edge, Samsung Internet, Opera, Brave, Android
  "android.googleapis.com", // legacy GCM endpoints still seen on old installs
  ".push.services.mozilla.com", // Firefox
  ".notify.windows.com", // legacy Edge / Windows
  "web.push.apple.com", // Safari, and the installed iPhone app (iOS 16.4+)
] as const;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_ALLOWLIST.some((allowed) =>
    allowed.startsWith(".") ? host.endsWith(allowed) && host.length > allowed.length : host === allowed
  );
}

/** How many devices one account may keep subscribed; the oldest drop off past this. */
export const MAX_DEVICES_PER_USER = 10;

/** Devices sent to at once. Big enough to be quick, small enough not to open 1,000 sockets. */
export const PUSH_BATCH_SIZE = 50;

export type PushPayload = { title: string; body: string; url: string };

/**
 * Sends one payload to many subscriptions, `PUSH_BATCH_SIZE` at a time. Never throws:
 * a dead endpoint (404/410) is deleted so the next send skips it; any other failure is
 * reported to Sentry and the rest carry on. Returns the counts for the caller's logs.
 */
export async function sendToSubscriptions(
  subs: Pick<IPushSubscription, "_id" | "endpoint" | "keys">[],
  payload: PushPayload,
  stage: string
): Promise<{ sent: number; removed: number; failed: number }> {
  const counts = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured) {
    console.warn(`[push] VAPID keys not configured — skipping ${stage}`);
    return counts;
  }
  const body = JSON.stringify(payload);
  for (let i = 0; i < subs.length; i += PUSH_BATCH_SIZE) {
    await Promise.allSettled(
      subs.slice(i, i + PUSH_BATCH_SIZE).map(async (sub) => {
        // Rows written before the allowlist existed are skipped, not trusted.
        if (!isAllowedPushEndpoint(sub.endpoint)) {
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
          counts.removed++;
          return;
        }
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, {
            TTL: 60 * 60 * 24,
            timeout: 10_000,
          });
          counts.sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
            counts.removed++;
          } else {
            counts.failed++;
            console.error(`[push] ${stage} send failed`, statusCode ?? "", err);
            Sentry.captureException(err, { tags: { stage }, extra: { statusCode } });
          }
        }
      })
    );
  }
  return counts;
}
