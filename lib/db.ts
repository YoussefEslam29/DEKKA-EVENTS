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
