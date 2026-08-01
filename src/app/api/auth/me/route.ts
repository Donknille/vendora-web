import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { getEffectivePlan } from "@/lib/plan";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      plan: getEffectivePlan(user),
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
