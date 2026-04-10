import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().max(200).default(""),
  address: z.string().max(500).default(""),
  email: z.string().max(254).default(""),
  phone: z.string().max(50).default(""),
  taxNote: z.string().max(500).default(""),
  smallBusinessNote: z.string().max(500).optional(),
  defaultShippingCost: z.number().min(0).max(99999.99).optional(),
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
