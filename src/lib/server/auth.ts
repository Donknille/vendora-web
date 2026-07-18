import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "./db";
import { users } from "./schema";
import { getUser, getSubscriptionStatus } from "./storage";

/**
 * Gets the authenticated user ID from the Better Auth session.
 * Also checks if the user is blocked / soft-deleted in the DB.
 * Returns null if unauthenticated, blocked, or deleted.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const [dbUser] = await db
    .select({ isBlocked: users.isBlocked, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId));

  if (dbUser?.isBlocked || dbUser?.deletedAt) return null;

  return userId;
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
