// GET  /api/submissions — band submissions inbox (admin only)
// POST /api/submissions — pitch a show; open to logged-out visitors by design
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BandSubmission, SUBMISSION_STATUSES } from "@/models/BandSubmission";
import { handle, parseBody } from "@/lib/api";
import { submissionSchema } from "@/lib/validation";
import { currentUser, guard } from "@/lib/rbac";
import { getSubmissions } from "@/lib/data";

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

    return NextResponse.json(
      { data: { id: String(submission._id), status: submission.status } },
      { status: 201 }
    );
  });
}
