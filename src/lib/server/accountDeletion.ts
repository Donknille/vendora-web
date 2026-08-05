import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";
import { user as authUser } from "./auth-schema";
import { getUser, deleteAllUserData, archiveUserInvoices } from "./storage";
import { getStripe } from "./stripe";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "stripe_failed" };

/**
 * Erases an account and everything belonging to it (DSGVO Art. 17).
 *
 * Shared by the user's own deletion in /api/account and the admin action, so
 * both follow exactly the same path — an admin deletion must not be a second,
 * sloppier implementation that forgets the invoice retention or the Stripe
 * customer.
 *
 * Order matters:
 *  1. Stripe first, because it is external and cannot participate in the DB
 *     transaction. If it fails we abort while the account is still intact.
 *  2. Issued invoices are archived, not deleted (§147 AO / §14b UStG): they are
 *     decoupled from the account and stamped with their retention deadline.
 *  3. Everything else is deleted, the profile row is soft-deleted so the email
 *     cannot be re-registered, and the Better Auth identity is removed (which
 *     cascades to sessions and signs the account out) — all in one transaction.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  const user = await getUser(userId);
  if (!user) return { ok: false, reason: "not_found" };

  if (user.stripeCustomerId) {
    try {
      await getStripe().customers.del(user.stripeCustomerId);
    } catch (error) {
      console.error("Failed to delete Stripe customer:", error);
      return { ok: false, reason: "stripe_failed" };
    }
  }

  await db.transaction(async (tx) => {
    await archiveUserInvoices(userId, tx);
    await deleteAllUserData(userId, tx);
    await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    await tx.delete(authUser).where(eq(authUser.id, userId));
  });

  return { ok: true };
}
