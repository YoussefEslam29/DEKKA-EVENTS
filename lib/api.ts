import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { ZodError, type ZodType } from "zod";

export function jsonError(message: string, status: number, extra?: unknown) {
  return NextResponse.json({ error: message, details: extra }, { status });
}

/**
 * Parses and validates a JSON request body. Returns either the typed value or a
 * ready-to-return 400, so handlers never touch raw `body` fields directly
 * (which is what makes NoSQL injection and mass assignment possible).
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ data: T } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: jsonError("Malformed JSON body", 400) };
  }

  try {
    return { data: schema.parse(raw) };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        response: jsonError(
          "Validation failed",
          400,
          error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
        ),
      };
    }
    throw error;
  }
}

export function isValidId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Wraps a handler so an unexpected throw becomes a logged 500, not a stack trace. */
export async function handle(
  label: string,
  fn: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[${label}]`, error);
    return jsonError("Internal server error", 500);
  }
}
