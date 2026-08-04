import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Handles all Better Auth endpoints: /api/auth/sign-in, /sign-up, /sign-out,
// /get-session, /forget-password, /reset-password, /verify-email, ...
export const { GET, POST } = toNextJsHandler(auth);
