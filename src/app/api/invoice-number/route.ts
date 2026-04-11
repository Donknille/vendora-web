import { NextResponse } from "next/server";
import { getAuthUserId, requireActiveSubscription } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function POST() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const subCheck = await requireActiveSubscription(userId);
    if (subCheck) return subCheck;

    const invoiceNumber = await storage.getNextInvoiceNumber(userId);
    return NextResponse.json({ invoiceNumber });
  } catch (error) {
    console.error("POST /api/invoice-number error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
