import { createClient } from "@/lib/supabase/server";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Gets the authenticated user ID from the Supabase session.
 * Fast — no DB query, only checks Supabase session cookie.
 * Use for read-only endpoints.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Gets the authenticated user ID AND checks if user is blocked.
 * Slower — makes an additional DB query.
 * Use for write endpoints (POST, PUT, DELETE).
 */
export async function getAuthUserIdStrict(): Promise<string | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const [dbUser] = await db
    .select({ isBlocked: users.isBlocked })
    .from(users)
    .where(eq(users.id, userId));

  if (dbUser?.isBlocked) return null;
  return userId;
}

/**
 * Ensures a user record exists in our users table.
 * Called after Supabase Auth signup/login.
 */
export async function ensureUserRecord(id: string, email: string) {
  const [existing] = await db.select().from(users).where(eq(users.id, id));
  if (existing) return existing;

  // Set trial period: 6 weeks from now
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 42);

  const [created] = await db
    .insert(users)
    .values({
      id,
      email,
      subscriptionStatus: "trial",
      trialEndsAt,
    })
    .returning();
  return created;
}
