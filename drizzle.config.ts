import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load .env files itself. Read .env.local so that
// `npm run db:migrate` works without exporting DATABASE_URL by hand.
// Skipped where the file does not exist (CI, Vercel) — there the variable
// comes from the real environment.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./src/lib/server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
