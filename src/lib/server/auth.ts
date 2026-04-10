import { createClient } from "@/lib/supabase/server";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Gets the authenticated user ID from the Supabase session.
 * Use this in API routes to protect endpoints.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check if user is blocked
  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id));
  if (dbUser?.isBlocked) return null;

  return user.id;
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
