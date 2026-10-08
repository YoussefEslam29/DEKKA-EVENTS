// GET  /api/submissions — band submissions inbox (admin only)
// POST /api/submissions — pitch a show; open to logged-out visitors by design
import { NextResponse, after } from "next/server";
import { connectDB } from "@/lib/db";
import { BandSubmission, SUBMISSION_STATUSES } from "@/models/BandSubmission";
import { handle, parseBody } from "@/lib/api";
import { submissionSchema } from "@/lib/validation";
import { currentUser, guard } from "@/lib/rbac";
import { getSubmissions } from "@/lib/data";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { emailEnabled, sendEmail } from "@/lib/email";
import { pitchReceivedEmailBody } from "@/lib/identity";

export async function GET(request: Request) {
  return handle("GET /api/submissions", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const status = new URL(request.url).searchParams.get("status");
    const valid = SUBMISSION_STATUSES.find((s) => s === status);

    return NextResponse.json({ data: await getSubmissions(valid) });
  });
}

export async function POST(request: Request) {
  return handle("POST /api/submissions", async () => {
    // Open to logged-out visitors by design, so IP is the only key available.
    const rl = await rateLimit("submission-ip", clientIp(request));
    if ("response" in rl) return rl.response;

    const parsed = await parseBody(request, submissionSchema);
    if ("response" in parsed) return parsed.response;
    const input = parsed.data;

    // A signed-in musician gets their submission linked to their account; a
    // logged-out one is still accepted — the email is the thread of contact.
    const user = await currentUser();

    await connectDB();
    const submission = await BandSubmission.create({
      ...input,
      links: input.links.filter(Boolean).slice(0, 10),
      user: user?.id ?? null,
      status: "pending",
    });

    // F3 (PLAN/SITE_ROADMAP.md): tell the band it arrived. After the response, never
    // blocking the form, and silent without a mail provider. The route is already
    // rate-limited per IP, which also caps how many of these one machine can trigger.
    if (emailEnabled) {
      const { subject, text } = pitchReceivedEmailBody(submission.bandName);
      after(() => sendEmail({ to: submission.email, subject, text }).then(() => undefined));
    }

    return NextResponse.json(
      { data: { id: String(submission._id), status: submission.status } },
      { status: 201 }
    );
  });
}
