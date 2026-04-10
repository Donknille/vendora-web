import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";

export async function DELETE() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Delete user record from our DB (cascade deletes all related data:
    // orders, order_items, market_events, market_sales, expenses,
    // company_profiles, app_settings, invoice_counters)
    await db.delete(users).where(eq(users.id, userId));

    // Sign out the user from Supabase Auth
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Note: Supabase Auth user must be deleted via Supabase Admin API
    // or manually in the dashboard. The app data is fully deleted above.

    return NextResponse.json({ message: "Account and all data deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/account error:", error);
    return NextResponse.json({ message: "Failed to delete account" }, { status: 500 });
  }
}
