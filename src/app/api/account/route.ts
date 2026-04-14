import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { getUser } from "@/lib/server/storage";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/server/stripe";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
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

    // Step 2: Delete Supabase Auth user (external, do before DB changes)
    try {
      const adminClient = getAdminClient();
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        console.error("Failed to delete Supabase auth user:", error);
        return NextResponse.json(
          { message: "Failed to delete authentication data. Please try again or contact support." },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Failed to delete Supabase auth user:", error);
      return NextResponse.json(
        { message: "Failed to delete authentication data. Please try again or contact support." },
        { status: 500 }
      );
    }

    // Step 3: Soft-delete the user record (cascade deletes all related data)
    // Mark as deleted first, then hard-delete
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json({ message: "Account and all data deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/account error:", error);
    return NextResponse.json({ message: "Failed to delete account" }, { status: 500 });
  }
}
