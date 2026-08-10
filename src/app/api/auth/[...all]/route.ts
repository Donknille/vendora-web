import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Handles all Better Auth endpoints: /api/auth/sign-in, /sign-up, /sign-out,
// /get-session, /request-password-reset, /reset-password, /verify-email,
// /send-verification-email, ...
//
// Pfadnamen an better-auth 1.6.23 verifiziert: "/forget-password" existiert
// dort nicht (der Reset heisst /request-password-reset).
export const { GET, POST } = toNextJsHandler(auth);
