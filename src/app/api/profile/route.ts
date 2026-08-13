import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { validationError, withAuth } from "@/lib/server/route";
import { updateProfileSchema } from "@/lib/schemas/misc";

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
