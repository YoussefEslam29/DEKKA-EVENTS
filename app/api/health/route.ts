// GET /api/health — liveness probe for an external uptime monitor
// (Before_Deployment.md §9). Returns 200 when the app can reach MongoDB, 503
// when it cannot, and always within ~5s.
//
// **This is the one intentionally unauthenticated route in the app**, and that
// is a deliberate exception to developer-guide.md §3 rule 1 ("every API route
// is guarded"), not an oversight. An uptime monitor cannot hold a session. The
// rule exists to stop data leaking, so the exception is bought by leaking
// nothing at all:
//
//   - no data of any kind, not even a count of documents
//   - no error text on failure. A Mongoose failure message can contain the
//     MONGODB_URI, credentials included (the exact leak lib/sentry-scrub.ts
//     exists to catch), so the failing branch returns a fixed string and puts
//     the real reason in the server log only.
//   - no version, build id, or hostname — nothing that helps fingerprint the
//     deployment.
//
// It also deliberately does **not** report to Sentry. The monitor polling this
// every 5 minutes is itself the alerting channel; capturing here would mean
// ~288 duplicate Sentry issues a day during an outage, burning the free tier
// precisely when attention is needed elsewhere.
//
// Add rate limiting in Phase 3: this is public, unauthenticated, and touches
// the database.
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";

// A cached 200 served while the database is down would defeat the entire point.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

// Mongoose's own serverSelectionTimeoutMS defaults to 30s, and connectDB() is
// shared, so its timeout can't be shortened just for this route. A monitor that
// hangs 30s on every poll during an outage is close to useless — so cap the
// whole check here instead. 5s is well under any monitor's request timeout and
// long enough that a momentarily slow Atlas response isn't a false alarm.
const CHECK_TIMEOUT_MS = 5000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`health check exceeded ${ms}ms`)), ms)
  );
}

export async function GET() {
  try {
    await Promise.race([
      (async () => {
        await connectDB();
        // `ping` is the cheapest round trip that proves the driver is actually
        // talking to the server, not just holding a socket it believes is open.
        await mongoose.connection.db?.admin().ping();
      })(),
      timeout(CHECK_TIMEOUT_MS),
    ]);
  } catch (error) {
    console.error("[GET /api/health] database unreachable", error);
    return NextResponse.json(
      { error: "unhealthy" },
      { status: 503, headers: NO_STORE }
    );
  }

  return NextResponse.json(
    { data: { status: "ok" } },
    { status: 200, headers: NO_STORE }
  );
}
