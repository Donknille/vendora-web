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
 *  3. Everything else is deleted — including the profile row itself — and the
 *     Better Auth identity is removed (which cascades to sessions and signs the
 *     account out), all in one transaction.
 *
 * The profile row used to be kept as a soft-delete tombstone so the email could
 * never be registered again. That contradicted both Art. 17 ("all data deleted")
 * and the privacy policy, and locked returning customers out for good. The email
 * is free again after deletion; trial abuse via delete-and-recreate is accepted
 * (see the trial-abuse item in docs/handover.md).
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
    await tx.delete(users).where(eq(users.id, userId));
    await tx.delete(authUser).where(eq(authUser.id, userId));
  });

  return { ok: true };
}
