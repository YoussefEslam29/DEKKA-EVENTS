// PATCH /api/submissions/:id — approve / decline / annotate a pitch (admin only)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BandSubmission } from "@/models/BandSubmission";
import { handle, isValidId, jsonError, parseBody } from "@/lib/api";
import { submissionUpdateSchema } from "@/lib/validation";
import { guard } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle("PATCH /api/submissions/:id", async () => {
    const auth = await guard("admin");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    const parsed = await parseBody(request, submissionUpdateSchema);
    if ("response" in parsed) return parsed.response;

    const update: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) update.status = parsed.data.status;
    if (parsed.data.adminNote !== undefined) update.adminNote = parsed.data.adminNote;

    await connectDB();
    const doc = await BandSubmission.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) return jsonError("Not found", 404);

    return NextResponse.json({
      data: { id: String(doc._id), status: doc.status, adminNote: doc.adminNote ?? "" },
    });
  });
}
