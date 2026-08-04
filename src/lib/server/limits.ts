import "server-only";
import { NextResponse } from "next/server";
import { getEffectivePlan, canCreate } from "@/lib/plan";
import * as storage from "./storage";

/**
 * Gate creation of new records (Phase 4.2). FREE accounts are read-only: they
 * can still view and download/export everything, but cannot create new data.
 * Returns a 403 for FREE, or null for PRO. Reads, downloads/exports, and the
 * Stripe checkout/portal are never gated.
 */
export async function requireWriteAccess(userId: string): Promise<NextResponse | null> {
  const user = await storage.getUser(userId);
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  if (canCreate(getEffectivePlan(user))) return null;

  return NextResponse.json(
    {
      message: "Zum Anlegen neuer Einträge wird Vendora Pro benötigt.",
      code: "PRO_REQUIRED",
    },
    { status: 403 }
  );
}
