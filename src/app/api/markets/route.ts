import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const quickItemSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().min(0).max(99999999), // cents
});

const marketStatusEnum = z.enum([
  "open",
  "applied",
  "confirmed",
  "completed",
  "cancelled",
]);

const createMarketSchema = z.object({
  name: z.string().min(1, "Market name is required").max(200),
  date: z.string().min(1, "Date is required").max(50),
  location: z.string().max(300).default(""),
  standFee: z.number().int().min(0).max(9999999).default(0), // cents
  travelCost: z.number().int().min(0).max(9999999).default(0), // cents
  notes: z.string().max(5000).default(""),
  status: marketStatusEnum.optional(),
  applicationDeadline: z.string().min(1).max(50).nullish(),
  quickItems: z.array(quickItemSchema).max(50).optional(),
});

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await storage.getMarkets(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/markets error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Creating a market requires PRO (FREE is read-only).
    const gate = await requireWriteAccess(userId);
    if (gate) return gate;

    const body = await request.json();
    const parsed = createMarketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const market = await storage.createMarket(userId, parsed.data);
    return NextResponse.json(market, { status: 201 });
  } catch (error) {
    console.error("POST /api/markets error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
