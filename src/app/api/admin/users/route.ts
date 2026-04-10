import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { users, orders, marketEvents, expenses } from "@/lib/server/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const allUsers = await db.select().from(users).orderBy(sql`${users.createdAt} DESC`);

    const usersWithStats = await Promise.all(
      allUsers.map(async (user) => {
        const [[orderCount], [marketCount], [expenseCount]] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(orders).where(eq(orders.userId, user.id)),
          db.select({ count: sql<number>`count(*)` }).from(marketEvents).where(eq(marketEvents.userId, user.id)),
          db.select({ count: sql<number>`count(*)` }).from(expenses).where(eq(expenses.userId, user.id)),
        ]);

        return {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          subscriptionStatus: user.subscriptionStatus,
          trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
          subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
          isBlocked: user.isBlocked ?? false,
          stats: {
            orders: Number(orderCount.count),
            markets: Number(marketCount.count),
            expenses: Number(expenseCount.count),
          },
        };
      })
    );

    return NextResponse.json(usersWithStats);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
