import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const updateSettingsSchema = z.object({
  theme: z.string().default("system"),
  currency: z.string().default("€"),
});

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const settings = await storage.getSettings(userId);
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const settings = await storage.upsertSettings(userId, parsed.data);
  return NextResponse.json(settings);
}
