import "server-only";
import arcjet, { fixedWindow, shield } from "@arcjet/next";
import { env } from "./env";

// Global Arcjet instance with bot protection and rate limiting
export const aj = arcjet({
  key: env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    // Shield: protect against common attacks (SQL injection, XSS probes, etc.)
    shield({ mode: "LIVE" }),
    // Global rate limit: 100 requests per 60s per IP
    fixedWindow({
      mode: "LIVE",
      max: 100,
      window: "60s",
    }),
  ],
});

// Stricter rate limit for auth endpoints (login, signup, password reset)
export const ajAuth = arcjet({
  key: env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    // 5 requests per 60s for auth endpoints
    fixedWindow({
      mode: "LIVE",
      max: 5,
      window: "60s",
    }),
  ],
});

// Rate limit for API write operations (POST, PUT, DELETE)
export const ajWrite = arcjet({
  key: env.ARCJET_KEY!,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    // 20 requests per 60s for write operations
    fixedWindow({
      mode: "LIVE",
      max: 20,
      window: "60s",
    }),
  ],
});
