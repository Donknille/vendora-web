import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { fail, withAuth } from "@/lib/server/route";

export const GET = withAuth("GET /api/subscription", async ({ userId }) => {
  const info = await storage.getPlanInfo(userId);
  if (!info) return fail(404, "User not found");

  return NextResponse.json(info);
});
