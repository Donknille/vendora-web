import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const updateOrderItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
  processingStatus: z.string().optional(),
  comment: z.string().optional(),
});

const updateOrderSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().optional(),
  customerAddress: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  orderDate: z.string().optional(),
  serviceDate: z.string().optional(),
  shippingCost: z.number().min(0).optional(),
  processingStatus: z.string().optional(),
  comment: z.string().optional(),
  items: z.array(updateOrderItemSchema).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await storage.deleteOrder(userId, id);
  return NextResponse.json({ message: "Order deleted" });
}
