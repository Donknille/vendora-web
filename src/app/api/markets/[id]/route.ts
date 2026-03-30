import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const quickItemSchema = z.object({
  name: z.string().min(1),
  price: z.number().min(0),
});

const updateMarketSchema = z.object({
  name: z.string().min(1).optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  standFee: z.number().min(0).optional(),
  travelCost: z.number().min(0).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  quickItems: z.array(quickItemSchema).optional(),
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
    const parsed = updateMarketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const market = await storage.updateMarket(userId, id, parsed.data);
    if (!market) {
      return NextResponse.json({ message: "Market not found" }, { status: 404 });
    }

    return NextResponse.json(market);
  } catch (error) {
    console.error("PUT /api/markets/[id] error:", error);
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
    await storage.deleteMarket(userId, id);
    return NextResponse.json({ message: "Market deleted" });
  } catch (error) {
    console.error("DELETE /api/markets/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
