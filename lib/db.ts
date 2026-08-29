import dns from "node:dns";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Next.js hot-reloads modules in dev, which would otherwise open a new pool on
// every reload. Cache the connection on globalThis so it survives reloads.
const globalWithMongoose = globalThis as typeof globalThis & {
  _dekkaMongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalWithMongoose._dekkaMongoose ??
  (globalWithMongoose._dekkaMongoose = { conn: null, promise: null });

/** Opens (or reuses) the MongoDB connection. Call before any Mongoose query. */
export async function connectDB(): Promise<typeof mongoose> {
  // Some Windows/router setups hand Node an IPv6 link-local DNS server (fe80::1)
  // that its resolver can't reach, breaking the SRV lookup mongodb+srv:// needs.
  // Next.js dev spreads request handling across worker threads, and
  // dns.setServers() only affects the thread that calls it, so this has to run
  // per-call rather than once at module load. Cheap and idempotent; skipped in
  // production, where hosts don't hit this DNS quirk.
  if (process.env.NODE_ENV !== "production") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and fill it in."
    );
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
  return cached.conn;
}
