import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { parsePagination } from "@/lib/server/pagination";
import { validationError, withAuth } from "@/lib/server/route";
import { createOrderSchema } from "@/lib/schemas/order";

export const GET = withAuth("GET /api/orders", async ({ userId, request }) => {
  const data = await storage.getOrders(userId, parsePagination(request));
  return NextResponse.json(data);
});

export const POST = withAuth("POST /api/orders", async ({ userId, request }) => {
  // Bleibt bewusst im Rumpf und nicht im Wrapper: wer eine Route liest, muss
  // sehen, wer sie benutzen darf.
  const gate = await requireWriteAccess(userId);
  if (gate) return gate;

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const order = await storage.createOrder(userId, parsed.data);
  return NextResponse.json(order, { status: 201 });
});
