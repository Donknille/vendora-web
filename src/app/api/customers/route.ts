import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { orders } from "@/lib/server/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Get unique customers with their most recent details
    const customers = await db
      .select({
        customerName: orders.customerName,
        customerEmail: orders.customerEmail,
        customerStreet: orders.customerStreet,
        customerZip: orders.customerZip,
        customerCity: orders.customerCity,
        customerCountry: orders.customerCountry,
      })
      .from(orders)
      .where(eq(orders.userId, userId))
      .groupBy(
        orders.customerName,
        orders.customerEmail,
        orders.customerStreet,
        orders.customerZip,
        orders.customerCity,
        orders.customerCountry,
      )
      .orderBy(sql`max(${orders.createdAt}) DESC`)
      .limit(50);

    return NextResponse.json(customers);
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
