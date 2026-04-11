import { NextResponse } from "next/server";
import { getAuthUserId, requireActiveSubscription } from "@/lib/server/auth";
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
  customerStreet: z.string().min(1, "Street is required").max(200),
  customerZip: z.string().min(1, "ZIP is required").max(20),
  customerCity: z.string().min(1, "City is required").max(100),
  customerCountry: z.string().max(100).default(""),
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

    const subCheck = await requireActiveSubscription(userId);
    if (subCheck) return subCheck;

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
