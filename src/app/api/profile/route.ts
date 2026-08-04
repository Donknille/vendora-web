import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
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

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const profile = await storage.getProfile(userId);
    return NextResponse.json(profile);
  } catch (error) {
    console.error("GET /api/profile error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const profile = await storage.upsertProfile(userId, parsed.data);
    return NextResponse.json(profile);
  } catch (error) {
    console.error("PUT /api/profile error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
