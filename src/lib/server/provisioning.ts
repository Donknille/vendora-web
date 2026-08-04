import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";
import { TRIAL_DAYS } from "@/lib/plan";

/**
 * User provisioning helpers.
 *
 * Kept separate from `auth.ts` (getAuthUserId) to avoid an import cycle:
 * `lib/auth.ts` (Better Auth instance) → this module, while
 * `lib/server/auth.ts` → `lib/auth.ts`.
 */

/**
 * Returns true if the given email belongs to a soft-deleted account.
 * Used by the Better Auth `user.create.before` hook to block re-registration
 * of previously deleted accounts (DSGVO soft-delete guard).
 */
export async function isEmailReserved(email: string): Promise<boolean> {
  const [row] = await db
    .select({ deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, email));
  return !!row?.deletedAt;
}

/**
 * Ensures an app profile row exists in our `users` table for a Better Auth user.
 * Called from the Better Auth `user.create.after` hook, with the same id as
 * Better Auth's `user.id`. Rejects previously deleted accounts (soft-delete guard).
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

  // New accounts get a TRIAL_DAYS full-access trial; the stored plan stays
  // "free" (the effective plan is "trial" while trialEndsAt is in the future).
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

  const [created] = await db
    .insert(users)
    .values({
      id,
      email,
      plan: "free",
      trialEndsAt,
    })
    .returning();
  return created;
}
