import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const updateOrderItemSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number().int().min(1).max(9999),
  price: z.number().min(0).max(999999.99),
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

const updateOrderSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerEmail: z.string().max(254).optional(),
  customerAddress: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  orderDate: z.string().max(50).optional(),
  serviceDate: z.string().max(50).optional(),
  shippingCost: z.number().min(0).max(99999.99).optional(),
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
  items: z.array(updateOrderItemSchema).max(100).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const order = await storage.updateOrder(userId, id, parsed.data);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("PUT /api/orders/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await storage.deleteOrder(userId, id);
    return NextResponse.json({ message: "Order deleted" });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
