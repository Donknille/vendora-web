import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { validationError, withAuth } from "@/lib/server/route";
import { z } from "zod";

// Defense-in-depth: reject strings that look like HTML/script injection
const noHtml = (val: string) => !/<script|<\/script|<iframe|<object|<embed|javascript:/i.test(val);

const safeStr = (max: number) => z.string().max(max).refine(noHtml, { message: "HTML tags are not allowed" });

const updateProfileSchema = z.object({
  name: safeStr(200).default(""),
  address: safeStr(500).default(""),
  email: safeStr(254).default(""),
  phone: safeStr(50).default(""),
  taxNote: safeStr(500).default(""),
  smallBusinessNote: safeStr(500).optional(),
  isSmallBusiness: z.boolean().default(true),
  defaultShippingCost: z.number().int().min(0).max(9999999).optional(), // cents
});

export const GET = withAuth("GET /api/profile", async ({ userId }) => {
  const profile = await storage.getProfile(userId);
  return NextResponse.json(profile);
});

export const PUT = withAuth("PUT /api/profile", async ({ userId, request }) => {
  const parsed = updateProfileSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const profile = await storage.upsertProfile(userId, parsed.data);
  return NextResponse.json(profile);
});
