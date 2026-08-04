import "server-only";
import { z } from "zod";

// Central, validated access to server-side environment variables.
// Import `env` instead of reading `process.env.X!` directly so that a missing
// or malformed secret fails fast with a clear message.
const envSchema = z.object({
  // Required for the app to function at runtime.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url().optional(),

  // Stripe (billing). Optional so local dev without billing still boots;
  // the routes that need them fail closed at request time.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Optional integrations — features degrade gracefully when unset.
  ARCJET_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof envSchema>;

function loadEnv(): ServerEnv {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  const message =
    "Invalid server environment variables: " +
    JSON.stringify(parsed.error.flatten().fieldErrors);

  // Secrets are injected at deploy time, not during `next build` / CI, so don't
  // hard-crash the build. Everywhere else (dev server, production runtime),
  // fail fast so misconfiguration surfaces immediately.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION
  ) {
    console.warn(`[env] ${message}`);
    return process.env as unknown as ServerEnv;
  }

  throw new Error(message);
}

export const env = loadEnv();
