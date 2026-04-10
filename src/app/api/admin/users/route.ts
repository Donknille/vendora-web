import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    // Single query with subquery counts (eliminates N+1)
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        subscriptionStatus: users.subscriptionStatus,
        trialEndsAt: users.trialEndsAt,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        isBlocked: users.isBlocked,
        orderCount: sql<number>`(SELECT count(*) FROM orders WHERE orders.user_id = "users"."id")`,
        marketCount: sql<number>`(SELECT count(*) FROM market_events WHERE market_events.user_id = "users"."id")`,
        expenseCount: sql<number>`(SELECT count(*) FROM expenses WHERE expenses.user_id = "users"."id")`,
      })
      .from(users)
      .orderBy(sql`${users.createdAt} DESC`);

    const usersWithStats = allUsers.map((user) => ({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      isBlocked: user.isBlocked ?? false,
      stats: {
        orders: Number(user.orderCount),
        markets: Number(user.marketCount),
        expenses: Number(user.expenseCount),
      },
    }));

    return NextResponse.json(usersWithStats);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
