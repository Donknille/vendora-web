import "server-only";
import { NextResponse } from "next/server";
import { getEffectivePlan, limitsFor, monthKey } from "@/lib/plan";
import * as storage from "./storage";

// Server-side enforcement of the plan feature limits (Phase 4.1). Each helper
// returns a 403 NextResponse if the free user is over the limit, or null to
// proceed. PRO users (unlimited) always pass. Credits (Phase 4.2) will extend
// requireMarketQuota to spend a credit instead of blocking.

/**
 * Gate market creation. The limit is counted against the *event month* of the
 * market being created (`marketDate`, ISO "YYYY-MM-DD").
 */
export async function requireMarketQuota(
  userId: string,
  marketDate: string
): Promise<NextResponse | null> {
  const user = await storage.getUser(userId);
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const plan = getEffectivePlan(user);
  const limit = limitsFor(plan).marketsPerMonth;
  if (limit === null) return null; // unlimited

  const key = monthKey(new Date(marketDate));
  const used = await storage.countMarketsInMonth(userId, key);
  if (used >= limit) {
    return NextResponse.json(
      {
        message: `Auf dem Free-Plan sind ${limit} Märkte pro Monat möglich.`,
        code: "MARKET_LIMIT_REACHED",
        limit,
        plan,
      },
      { status: 403 }
    );
  }
  return null;
}

/** Gate invoice issuance against the current month's invoice limit. */
export async function requireInvoiceQuota(userId: string): Promise<NextResponse | null> {
  const user = await storage.getUser(userId);
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const plan = getEffectivePlan(user);
  const limit = limitsFor(plan).invoicesPerMonth;
  if (limit === null) return null; // unlimited

  const key = monthKey(new Date());
  const used = await storage.countInvoicesInMonth(userId, key);
  if (used >= limit) {
    return NextResponse.json(
      {
        message: `Auf dem Free-Plan sind ${limit} Rechnungen pro Monat möglich.`,
        code: "INVOICE_LIMIT_REACHED",
        limit,
        plan,
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Gate the EÜR/DATEV export behind the plan's yearExport entitlement. Phase 4.3
 * will additionally allow a per-year one-time purchase to unlock this for free
 * users; the `year` argument is already threaded through for that.
 */
export async function requireYearExport(
  userId: string,
  _year: number
): Promise<NextResponse | null> {
  const user = await storage.getUser(userId);
  if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

  const plan = getEffectivePlan(user);
  if (limitsFor(plan).yearExport) return null;

  return NextResponse.json(
    {
      message: "Der Jahresexport ist im Pro-Plan enthalten.",
      code: "EXPORT_REQUIRES_UPGRADE",
      plan,
    },
    { status: 403 }
  );
}
