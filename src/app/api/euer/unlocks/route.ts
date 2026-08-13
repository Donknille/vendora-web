import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { withAuth } from "@/lib/server/route";

// Tax years the user has already generated the GuV/EÜR export for. A FREE
// (read-only) account may still re-export exactly these years (Phase 4.6).
export const GET = withAuth("GET /api/euer/unlocks", async ({ userId }) => {
  const years = await storage.getEuerExportYears(userId);
  return NextResponse.json({ years });
});
