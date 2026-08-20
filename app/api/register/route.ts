// POST /api/register — create an email/password member account (public).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  return handle("POST /api/register", async () => {
    const parsed = await parseBody(request, registerSchema);
    if ("response" in parsed) return parsed.response;
    const { name, email, phone, password } = parsed.data;

    await connectDB();
    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) return jsonError("EMAIL_TAKEN", 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      providers: ["credentials"],
      role: "member",
    });

    // Never echo the hash back, even to the account's own owner.
    return NextResponse.json(
      { data: { id: String(user._id), name: user.name, email: user.email } },
      { status: 201 }
    );
  });
}
