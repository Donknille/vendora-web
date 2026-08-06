// Pure derivation of a market's cost expense rows (stand fee + travel cost).
// Shared by storage.syncMarketExpenses and the backup-restore route so both stay
// in sync; kept side-effect-free so it can be unit-tested without a database.
//
// Costs are only booked once the market is actually happening — a market one has
// merely applied for, or that was cancelled, must not sit in the EÜR. The same
// rule is mirrored in drizzle/0015_market_cost_status_gate.sql; changes here
// have to be carried over there.

export interface DerivedMarketCost {
  description: string;
  amount: number; // integer cents
  category: "standgebuehren_raumkosten" | "fahrtkosten";
  source: "market_fee" | "market_travel";
  expenseDate: string;
}

export interface MarketCostSource {
  name: string;
  date: string;
  standFee: number;
  travelCost: number;
  /** open | applied | confirmed | completed | cancelled; null behaves like open. */
  status: string | null;
}

/** Only a confirmed or completed market books its costs. */
export const COST_BOOKING_STATUSES = ["confirmed", "completed"] as const;

export function shouldBookMarketCosts(status: string | null | undefined): boolean {
  return (COST_BOOKING_STATUSES as readonly string[]).includes(status ?? "");
}

export function deriveMarketCosts(market: MarketCostSource): DerivedMarketCost[] {
  if (!shouldBookMarketCosts(market.status)) return [];

  const rows: DerivedMarketCost[] = [];
  if (market.standFee > 0) {
    rows.push({
      description: `Standgebühr – ${market.name}`.slice(0, 200),
      amount: market.standFee,
      category: "standgebuehren_raumkosten",
      source: "market_fee",
      expenseDate: market.date,
    });
  }
  if (market.travelCost > 0) {
    rows.push({
      description: `Fahrtkosten – ${market.name}`.slice(0, 200),
      amount: market.travelCost,
      category: "fahrtkosten",
      source: "market_travel",
      expenseDate: market.date,
    });
  }
  return rows;
}

/**
 * The rows ready to be inserted — the one place that attaches owner and market,
 * so the writer and the restore path cannot drift apart.
 */
export function planMarketCostRows(
  market: MarketCostSource,
  ctx: { userId: string; marketId: string }
): (DerivedMarketCost & { userId: string; marketId: string })[] {
  return deriveMarketCosts(market).map((row) => ({ ...row, ...ctx }));
}
