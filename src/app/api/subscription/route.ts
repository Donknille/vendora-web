import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const info = await storage.getPlanInfo(userId);
    if (!info) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(info);
  } catch (error) {
    console.error("GET /api/subscription error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
