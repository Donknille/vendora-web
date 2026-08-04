// Pure helpers for the market calendar (Phase 3.4): status metadata, application
// deadline state, and year-over-year comparison. No React / DB imports so it is
// trivially unit-testable. Dates are ISO "YYYY-MM-DD" strings; "today" is always
// passed in rather than read from the clock (keeps the functions deterministic).

export type MarketStatus =
  | "open"
  | "applied"
  | "confirmed"
  | "completed"
  | "cancelled";

export const MARKET_STATUSES: MarketStatus[] = [
  "open",
  "applied",
  "confirmed",
  "completed",
  "cancelled",
];

export function statusLabel(status: string | null, de: boolean): string {
  const labels: Record<MarketStatus, [string, string]> = {
    open: ["Geplant", "Planned"],
    applied: ["Beworben", "Applied"],
    confirmed: ["Zugesagt", "Confirmed"],
    completed: ["Abgeschlossen", "Completed"],
    cancelled: ["Abgesagt", "Cancelled"],
  };
  const entry = labels[(status ?? "open") as MarketStatus] ?? labels.open;
  return de ? entry[0] : entry[1];
}

// Tailwind classes for a small status badge.
export function statusClasses(status: string | null): string {
  switch (status) {
    case "confirmed":
      return "bg-green-500/10 text-green-600";
    case "applied":
      return "bg-amber-500/10 text-amber-600";
    case "completed":
      return "bg-brand-primary/10 text-brand-primary";
    case "cancelled":
      return "bg-red-500/10 text-red-500";
    default: // open
      return "bg-elevated text-faint";
  }
}

export type DeadlineState = "none" | "upcoming" | "soon" | "overdue";

export interface DeadlineInfo {
  state: DeadlineState;
  days: number | null; // whole days from today to the deadline (negative = past)
}

// Whole days between two ISO dates (b − a), UTC-based to avoid DST drift.
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  return Math.round((db - da) / 86400000);
}

/**
 * Classifies an application deadline relative to `today`. Only "actionable"
 * statuses (open/applied) surface soon/overdue; once confirmed/completed/
 * cancelled the deadline is no longer relevant.
 */
export function deadlineInfo(
  deadline: string | null,
  today: string,
  status: string | null
): DeadlineInfo {
  if (!deadline) return { state: "none", days: null };
  const days = daysBetween(today, deadline);
  const actionable = status === "open" || status === "applied" || status == null;
  if (!actionable) return { state: "upcoming", days };
  if (days < 0) return { state: "overdue", days };
  if (days <= 7) return { state: "soon", days };
  return { state: "upcoming", days };
}

export interface MarketLike {
  id: string;
  date: string;
  standFee: number;
  travelCost: number;
}

export interface SaleLike {
  amount: number;
  quantity: number;
}

export interface YearStat {
  year: number;
  marketId: string;
  date: string;
  sales: number; // cents
  profit: number; // cents
  salesCount: number;
}

/**
 * Year-over-year stats for a set of markets that share a name (a "series").
 * Newest year first.
 */
export function computeYearComparison(
  markets: MarketLike[],
  salesByMarketId: Record<string, SaleLike[]>
): YearStat[] {
  return markets
    .map((m) => {
      const sales = salesByMarketId[m.id] ?? [];
      const total = sales.reduce(
        (sum, s) => sum + (Number(s.amount) || 0) * (Number(s.quantity) || 0),
        0
      );
      const profit = total - (Number(m.standFee) || 0) - (Number(m.travelCost) || 0);
      return {
        year: Number(m.date.slice(0, 4)),
        marketId: m.id,
        date: m.date,
        sales: total,
        profit,
        salesCount: sales.length,
      };
    })
    .sort((a, b) => b.year - a.year || b.date.localeCompare(a.date));
}
