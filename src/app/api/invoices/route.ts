import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";

const issueInvoiceSchema = z.object({
  orderId: z.string().min(1).max(100),
});

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await storage.getInvoices(userId, parsePagination(request));
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Issuing an invoice creates a new record → requires PRO (FREE is read-only).
    const gate = await requireWriteAccess(userId);
    if (gate) return gate;

    const body = await request.json();
    const parsed = issueInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await storage.issueInvoice(userId, parsed.data.orderId);
    if (!result.ok) {
      if (result.code === "order_not_found") {
        return NextResponse.json({ message: "Order not found" }, { status: 404 });
      }
      return NextResponse.json(
        { message: "An active invoice already exists for this order", code: "ALREADY_ISSUED" },
        { status: 409 }
      );
    }

    return NextResponse.json(result.invoice, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
