// DELETE /api/checkins/:id — undo a mistyped door entry (staff/admin)
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { CheckIn } from "@/models/CheckIn";
import { handle, isValidId, jsonError } from "@/lib/api";
import { guard } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  return handle("DELETE /api/checkins/:id", async () => {
    const auth = await guard("staff");
    if ("response" in auth) return auth.response;

    const { id } = await params;
    if (!isValidId(id)) return jsonError("Invalid ID", 400);

    await connectDB();
    const removed = await CheckIn.findByIdAndDelete(id).lean();
    if (!removed) return jsonError("Not found", 404);

    return NextResponse.json({ data: { success: true } });
  });
}
