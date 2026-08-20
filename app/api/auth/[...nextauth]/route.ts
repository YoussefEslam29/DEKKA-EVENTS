// GET/POST /api/auth/* — Auth.js sign-in, sign-out, callback and session routes.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
