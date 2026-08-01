import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

// Tax years the user has already generated the GuV/EÜR export for. A FREE
// (read-only) account may still re-export exactly these years (Phase 4.6).
export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const years = await storage.getEuerExportYears(userId);
    return NextResponse.json({ years });
  } catch (error) {
    console.error("GET /api/euer/unlocks error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
