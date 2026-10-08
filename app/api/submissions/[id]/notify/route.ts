// POST /api/submissions/:id/notify — email the band the decision on their pitch (admin).
// PLAN/SITE_ROADMAP.md F3. Deliberately a button, not automatic on approve/decline: a
// decision clicked by mistake shouldn't already be in the band's inbox.
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BandSubmission } from "@/models/BandSubmission";
import { handle, isValidId, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";
import { rateLimit } from "@/lib/ratelimit";
import { emailEnabled, sendEmail } from "@/lib/email";
import { pitchDecisionEmailBody } from "@/lib/identity";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return handle("POST /api/submissions/:id/notify", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const rl = await rateLimit("email-band", auth.user.id);
    if ("response" in rl) return rl.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);
    if (!emailEnabled) return jsonError("EMAIL_DISABLED", 503);

    await connectDB();
    const submission = await BandSubmission.findById(id).lean();
    if (!submission) return jsonError("Not found", 404);
    if (submission.status !== "approved" && submission.status !== "declined") {
      return jsonError("NOT_DECIDED", 409);
    }

    const { subject, text } = pitchDecisionEmailBody(submission.bandName, submission.status);
    const result = await sendEmail({ to: submission.email, subject, text });
    if (!result.ok) return jsonError("EMAIL_FAILED", 502);

    const notifiedAt = new Date();
    await BandSubmission.updateOne({ _id: id }, { $set: { notifiedAt } });
    return NextResponse.json({ data: { notifiedAt: notifiedAt.toISOString() } });
  });
}
