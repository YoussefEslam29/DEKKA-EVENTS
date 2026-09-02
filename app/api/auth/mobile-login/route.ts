// POST /api/auth/mobile-login — exchange email/password for a bearer token (public).
//
// The native app's half of the auth bridge in `PLAN/DEKKA_MOBILE_APP.MD` §3.
// NextAuth's credentials provider validates the same two fields and answers with
// an httpOnly session cookie; this route validates them the same way and answers
// with a bearer token instead, because a native app cannot hold that cookie.
//
// Same `User` collection, same `passwordHash`, same `role`, same rate-limit
// buckets — everything except the delivery mechanism is shared with the web path
// in `lib/auth.ts`. Keeping them in step is the whole point: two sign-in routes
// that drift apart is how one of them ends up weaker than the other.
//
// **No CORS headers here, deliberately** — `developer-guide.md` §3 rule 7 warned
// that a mobile app would tempt someone into adding them. It doesn't: a native
// Android client is not a browser and is not bound by the same-origin policy, so
// it needs no `Access-Control-Allow-Origin` to call this. Adding a wildcard would
// hand every website on the internet the ability to make authenticated requests
// with a signed-in member's cookies, which is exactly what that rule exists to
// prevent. If a browser-based client is ever built, add an explicit origin
// allowlist — never a wildcard.
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { handle, jsonError, parseBody } from "@/lib/api";
import { mobileLoginSchema } from "@/lib/validation";
import { issueMobileToken } from "@/lib/mobile-token";
import {
  clientIp,
  consumeRateLimit,
  peekRateLimit,
  rateLimit,
} from "@/lib/ratelimit";

export async function POST(request: Request) {
  return handle("POST /api/auth/mobile-login", async () => {
    const parsed = await parseBody(request, mobileLoginSchema);
    if ("response" in parsed) return parsed.response;
    const { email, password } = parsed.data;

    // The same two buckets `lib/auth.ts`'s `authorize()` charges, keyed the same
    // way, on purpose. A separate bucket for this route would mean an attacker
    // could double their allowance against one account just by alternating
    // between the app's endpoint and the website's — a new sign-in channel must
    // share the existing limits, not add a parallel set.
    const byIp = await rateLimit("signin-ip", clientIp(request));
    if ("response" in byIp) return byIp.response;

    // Peeked, not charged: the email bucket is spent only on a *failed* attempt
    // below, so a member signing in on a new phone doesn't burn their own
    // allowance. Same discipline as the credentials provider.
    if (!(await peekRateLimit("signin-email", email))) {
      return jsonError("Too many requests", 429, { code: "RATE_LIMITED" });
    }

    await connectDB();
    // `passwordHash` is `select: false` on the model — pulled in explicitly here
    // and nowhere else, exactly as the credentials `authorize()` does.
    const user = await User.findOne({ email }).select("+passwordHash").lean();

    // One response for all three failures — unknown address, OAuth-only account
    // with no hash, and wrong password — so this endpoint can't be used to test
    // which emails have accounts. The bucket is charged for an unknown address
    // too, or its remaining count would become that oracle instead.
    //
    // Honest note: `bcrypt.compare` only runs when a hash exists, so response
    // *timing* still differs between a known and an unknown address. That is
    // inherited from `lib/auth.ts`'s credentials path rather than introduced
    // here, and the two are deliberately kept identical — see
    // `developer-guide.md` §7.
    if (!user?.passwordHash) {
      await consumeRateLimit("signin-email", email);
      return jsonError("INVALID_CREDENTIALS", 401);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await consumeRateLimit("signin-email", email);
      return jsonError("INVALID_CREDENTIALS", 401);
    }

    const { token, expiresAt } = await issueMobileToken({
      sub: String(user._id),
      name: user.name ?? null,
      email: user.email ?? null,
      role: user.role,
      phone: user.phone ?? "",
    });

    // The user block mirrors `SessionUser` so the app can populate its Account
    // screen from the sign-in response without a second round trip. Built field
    // by field rather than spread, so the hash cannot ride along — the same
    // reason `POST /api/register` returns an explicit literal.
    return NextResponse.json({
      data: {
        token,
        expiresAt,
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone ?? "",
        },
      },
    });
  });
}
