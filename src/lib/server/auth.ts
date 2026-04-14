import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "./db";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import { getUser, getSubscriptionStatus } from "./storage";

/**
 * Gets the authenticated user ID from the Supabase session.
 * Also checks if the user is blocked in the DB.
 * Returns null if unauthenticated or blocked.
 */
export async function getAuthUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const [dbUser] = await db
    .select({ isBlocked: users.isBlocked, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, user.id));

  if (dbUser?.isBlocked || dbUser?.deletedAt) return null;

  return user.id;
}

/**
 * Checks if the user has an active subscription.
 * Returns NextResponse error if not, or null if subscription is active.
 */
export async function requireActiveSubscription(userId: string): Promise<NextResponse | null> {
  const user = await getUser(userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }
  const sub = getSubscriptionStatus(user);
  if (!sub.isActive) {
    return NextResponse.json(
      { message: "Subscription required", code: "SUBSCRIPTION_REQUIRED", subscription: sub },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Ensures a user record exists in our users table.
 * Called after Supabase Auth signup/login.
 * Rejects previously deleted accounts (soft-delete guard).
 */
export async function ensureUserRecord(id: string, email: string) {
  const [existing] = await db.select().from(users).where(eq(users.id, id));

  // Block re-creation of deleted accounts
  if (existing?.deletedAt) {
    return null;
  }

  if (existing) return existing;

  // Also check if this email was previously used by a deleted account
  const [deletedByEmail] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));
  if (deletedByEmail?.deletedAt) {
    return null;
  }

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
