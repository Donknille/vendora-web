import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function POST() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const sub = storage.getSubscriptionStatus(user);
    if (!sub.isActive) {
      return NextResponse.json(
        { message: "Subscription required", code: "SUBSCRIPTION_REQUIRED", subscription: sub },
        { status: 403 }
      );
    }

    const invoiceNumber = await storage.getNextInvoiceNumber(userId);
    return NextResponse.json({ invoiceNumber });
  } catch (error) {
    console.error("POST /api/invoice-number error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
