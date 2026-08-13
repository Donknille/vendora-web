import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { validationError, withAuth } from "@/lib/server/route";
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

export const GET = withAuth("GET /api/markets", async ({ userId }) => {
  const data = await storage.getMarkets(userId);
  return NextResponse.json(data);
});

export const POST = withAuth("POST /api/markets", async ({ userId, request }) => {
  // Creating a market requires PRO (FREE is read-only).
  const gate = await requireWriteAccess(userId);
  if (gate) return gate;

  const parsed = createMarketSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const market = await storage.createMarket(userId, parsed.data);
  return NextResponse.json(market, { status: 201 });
});
