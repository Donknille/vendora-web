import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const orderItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number().int().min(1).max(9999),
  price: z.number().min(0).max(999999.99),
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").max(200),
  customerEmail: z.string().max(254).default(""),
  customerAddress: z.string().max(500).default(""),
  status: z.string().max(50).default("open"),
  notes: z.string().max(5000).default(""),
  orderDate: z.string().min(1, "Order date is required").max(50),
  serviceDate: z.string().max(50).optional(),
  shippingCost: z.number().min(0).max(99999.99).optional(),
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required").max(100),
});

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await storage.getOrders(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const order = await storage.createOrder(userId, parsed.data);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
