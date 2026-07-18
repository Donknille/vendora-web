// Pure derivation of a market's cost expense rows (stand fee + travel cost).
// Shared by storage.syncMarketExpenses and the backup-restore route so both stay
// in sync; kept side-effect-free so it can be unit-tested without a database.

export interface DerivedMarketCost {
  description: string;
  amount: number; // integer cents
  category: "standgebuehren_raumkosten" | "fahrtkosten";
  source: "market_fee" | "market_travel";
  expenseDate: string;
}

export function deriveMarketCosts(market: {
  name: string;
  date: string;
  standFee: number;
  travelCost: number;
}): DerivedMarketCost[] {
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
