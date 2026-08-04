import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "./db";
import { users } from "./schema";

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

  // Fail closed: a session without a matching app-profile row (e.g. if the
  // provisioning hook failed) must not be treated as authenticated.
  if (!dbUser) return null;
  if (dbUser.isBlocked || dbUser.deletedAt) return null;

  return userId;
}

// Note: the former `requireActiveSubscription` blanket gate is gone (Phase 4.1).
// Access is FREE by default within plan limits — see src/lib/server/limits.ts
// (requireMarketQuota / requireInvoiceQuota / requireYearExport).
