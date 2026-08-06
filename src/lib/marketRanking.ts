// Profit per market, as shown on the dashboard. Pure and testable.
//
// Costs come from the *booked* expense rows (source market_fee/market_travel),
// not from market.standFee/travelCost. After the status gate a market that was
// cancelled still carries its planned fees, but books nothing — taking the
// planned values would show a loss here that the expense KPI right next to it
// does not contain. `costsBooked` makes that difference visible instead of
// silently picking one of two numbers.

import type { MarketEvent, MarketSale, Expense } from "@/lib/types";

export interface MarketRankingRow {
  id: string;
  name: string;
  revenue: number; // cents
  costs: number; // cents, booked
  profit: number; // revenue - costs
  /** false = the market has planned costs that are not booked (status gate). */
  costsBooked: boolean;
}

export interface MarketRankingInput {
  markets: Pick<MarketEvent, "id" | "name" | "date" | "standFee" | "travelCost">[];
  marketSales: Pick<MarketSale, "marketId" | "amount" | "quantity">[];
  expenses: Pick<Expense, "marketId" | "source" | "amount">[]; // reporting expenses
  /** null/undefined = every year; filtered on the market day. */
  years?: number[] | null;
}

export function computeMarketRanking(input: MarketRankingInput): MarketRankingRow[] {
  const yearFilter = input.years ? new Set(input.years) : null;
  const markets = yearFilter
    ? input.markets.filter((m) => yearFilter.has(Number(m.date?.slice(0, 4))))
    : input.markets;
  const marketIds = new Set(markets.map((m) => m.id));

  const revenueById = new Map<string, number>();
  for (const sale of input.marketSales) {
    if (!marketIds.has(sale.marketId)) continue;
    const amount = (Number(sale.amount) || 0) * (Number(sale.quantity) || 1);
    revenueById.set(sale.marketId, (revenueById.get(sale.marketId) || 0) + amount);
  }

  const costsById = new Map<string, number>();
  for (const expense of input.expenses) {
    if (!expense.marketId || expense.source === "manual") continue;
    if (!marketIds.has(expense.marketId)) continue;
    costsById.set(expense.marketId, (costsById.get(expense.marketId) || 0) + (Number(expense.amount) || 0));
  }

  return markets
    .map((market) => {
      const revenue = revenueById.get(market.id) || 0;
      const costs = costsById.get(market.id) || 0;
      const planned = (Number(market.standFee) || 0) + (Number(market.travelCost) || 0);
      return {
        id: market.id,
        name: market.name || "—",
        revenue,
        costs,
        profit: revenue - costs,
        costsBooked: costs > 0 || planned === 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}
