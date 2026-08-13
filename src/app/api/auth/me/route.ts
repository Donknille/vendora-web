import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { getEffectivePlan } from "@/lib/plan";
import { fail, withAuth } from "@/lib/server/route";

export const GET = withAuth("GET /api/auth/me", async ({ userId }) => {
  const user = await storage.getUser(userId);
  if (!user) return fail(404, "User not found");

  return NextResponse.json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    plan: getEffectivePlan(user),
  });
});
