import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { getUser, deleteAllUserData } from "@/lib/server/storage";
import { getStripe } from "@/lib/server/stripe";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { user as authUser } from "@/lib/server/auth-schema";
import { eq } from "drizzle-orm";

export async function DELETE() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // Step 1: Delete Stripe customer (external, do before DB changes)
    if (user.stripeCustomerId) {
      try {
        await getStripe().customers.del(user.stripeCustomerId);
      } catch (error) {
        console.error("Failed to delete Stripe customer:", error);
        return NextResponse.json(
          { message: "Failed to delete payment data. Please try again or contact support." },
          { status: 500 }
        );
      }
    }

    // Step 2: Delete all user data, soft-delete the profile row, and remove the
    // Better Auth identity — atomically in a single transaction (same DB now).
    await db.transaction(async (tx) => {
      // Delete all user data (orders, markets, expenses, profile, settings, etc.)
      await deleteAllUserData(userId, tx);
      // Soft-delete the profile record to prevent re-registration with the same email
      await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
      // Delete the Better Auth user (cascades to sessions/accounts) — logs them out
      await tx.delete(authUser).where(eq(authUser.id, userId));
    });

    return NextResponse.json({ message: "Account and all data deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/account error:", error);
    return NextResponse.json({ message: "Failed to delete account" }, { status: 500 });
  }
}
