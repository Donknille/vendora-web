// Pure day-closing ("Tagesabschluss") math for the market mode (Phase 3.3).
// Kept dependency-free and side-effect-free so it is trivially testable and can
// combine server sales with not-yet-synced offline sales. All money is integer
// cents (revenue = amount × quantity per line).

export type SalePaymentMethod = "cash" | "card";

export interface DaySaleLike {
  amount: number; // cents (per unit)
  quantity: number;
  paymentMethod: SalePaymentMethod | null;
}

export interface DayClosing {
  count: number; // number of sale lines
  itemCount: number; // summed quantity
  total: number; // cents
  cash: number; // cents
  card: number; // cents
  unknown: number; // cents — sales with no payment method recorded
  standFee: number; // cents
  travelCost: number; // cents
  costs: number; // cents (standFee + travelCost)
  profit: number; // cents (total − costs)
}

export function computeDayClosing(
  sales: DaySaleLike[],
  standFee: number,
  travelCost: number
): DayClosing {
  let itemCount = 0;
  let total = 0;
  let cash = 0;
  let card = 0;
  let unknown = 0;

  for (const s of sales) {
    const qty = Number(s.quantity) || 0;
    const revenue = (Number(s.amount) || 0) * qty;
    itemCount += qty;
    total += revenue;
    if (s.paymentMethod === "cash") cash += revenue;
    else if (s.paymentMethod === "card") card += revenue;
    else unknown += revenue;
  }

  const fee = Number(standFee) || 0;
  const travel = Number(travelCost) || 0;
  const costs = fee + travel;

  return {
    count: sales.length,
    itemCount,
    total,
    cash,
    card,
    unknown,
    standFee: fee,
    travelCost: travel,
    costs,
    profit: total - costs,
  };
}
