import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { users, orders, marketEvents, expenses } from "@/lib/server/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const [[userStats], [orderCount], [marketCount], [expenseCount]] =
      await Promise.all([
        db.select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'active')`,
          trial: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'trial')`,
          expired: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'expired')`,
          blocked: sql<number>`count(*) filter (where ${users.isBlocked} = true)`,
        }).from(users),
        db.select({ count: sql<number>`count(*)` }).from(orders),
        db.select({ count: sql<number>`count(*)` }).from(marketEvents),
        db.select({ count: sql<number>`count(*)` }).from(expenses),
      ]);

    return NextResponse.json({
      totalUsers: Number(userStats.total),
      activeSubscriptions: Number(userStats.active),
      trialUsers: Number(userStats.trial),
      expiredUsers: Number(userStats.expired),
      blockedUsers: Number(userStats.blocked),
      totalOrders: Number(orderCount.count),
      totalMarkets: Number(marketCount.count),
      totalExpenses: Number(expenseCount.count),
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
