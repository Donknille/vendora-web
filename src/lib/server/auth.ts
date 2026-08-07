import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "./db";
import { users } from "./schema";

/**
 * Gets the authenticated user ID from the Better Auth session.
 * Also checks whether the user is blocked in the DB.
 * Returns null if unauthenticated, blocked, or without a profile row.
 */
export async function getAuthUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return null;

  const [dbUser] = await db
    .select({ isBlocked: users.isBlocked })
    .from(users)
    .where(eq(users.id, userId));

  // Fail closed: a session without a matching app-profile row must not count as
  // authenticated — that covers both a failed provisioning hook and a deleted
  // account whose row is gone while a stale session cookie is still around.
  if (!dbUser) return null;
  if (dbUser.isBlocked) return null;

  return userId;
}

// Note: the former `requireActiveSubscription` blanket gate is gone (Phase 4.1).
// Access is FREE by default within plan limits — see src/lib/server/limits.ts
// (requireMarketQuota / requireInvoiceQuota / requireYearExport).
