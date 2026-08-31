// Outbound email. Currently one caller (password reset), one provider (Resend).
//
// Deliberately a thin wrapper over `fetch` rather than the `resend` SDK: the whole
// surface used here is one POST, and this keeps a dependency (and its transitive tree)
// out of the bundle for a feature that sends a handful of emails a month. Swapping
// provider means rewriting this file only — nothing above it knows what Resend is.
import * as Sentry from "@sentry/nextjs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

/**
 * Can this deploy actually send mail?
 *
 * Exported because the UI reads it: the "Forgot password?" link is hidden when this is
 * false, exactly as `enabledOAuthProviders` hides a social button with no client ID. A
 * link to a flow that silently cannot deliver is worse than no link — the user believes
 * an email is coming and waits for it.
 */
export const emailEnabled = Boolean(apiKey && from);

export type SendResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends one transactional email. Never throws — callers are on request paths where a
 * mail failure must not become a 500, and (for password reset specifically) must not
 * change the response, since a different response for "send failed" would leak whether
 * the address exists.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  if (!emailEnabled) {
    // Not an error: an install without a mail provider is a supported state.
    console.warn("[email] RESEND_API_KEY/EMAIL_FROM not set — email not sent");
    return { ok: false, reason: "not-configured" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        // Plain text only — no HTML, so no tracking pixels and no remote images.
        text: options.text,
      }),
    });

    if (!response.ok) {
      // Read the body for the log, but never return it to the caller: it can name the
      // recipient, and callers must not vary their behaviour on it.
      const detail = await response.text().catch(() => "");
      console.error(`[email] send failed ${response.status}`, detail.slice(0, 300));
      Sentry.captureMessage(`[email] Resend returned ${response.status}`, "error");
      return { ok: false, reason: `http-${response.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error("[email] send threw", error);
    Sentry.captureException(error, { tags: { stage: "email-send" } });
    return { ok: false, reason: "threw" };
  }
}
