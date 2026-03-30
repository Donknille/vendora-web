import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().default(""),
  address: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  taxNote: z.string().default(""),
  smallBusinessNote: z.string().optional(),
  defaultShippingCost: z.number().min(0).optional(),
});

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await storage.getProfile(userId);
  return NextResponse.json(profile);
}

export async function PUT(request: Request) {
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
}
