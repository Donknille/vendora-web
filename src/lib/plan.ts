// Plan model + feature limits (Phase 4.1). Pure and dependency-free so it is
// shared by server enforcement and client display and is trivially testable.
//
// Vendora has no subscription lock-out anymore: everyone can use the app on the
// FREE plan within monthly limits. PRO (an optional subscription) lifts the
// limits. Credits (Phase 4.2) let a free user exceed the market limit per day.

export type Plan = "free" | "pro";

export interface PlanLimits {
  // null = unlimited
  marketsPerMonth: number | null;
  invoicesPerMonth: number | null;
  yearExport: boolean;
}

// Default free-tier limits (see docs/REBUILD-PLAN.md → Phase 4.1). Central so
// they can be tuned in one place.
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { marketsPerMonth: 2, invoicesPerMonth: 5, yearExport: false },
  pro: { marketsPerMonth: null, invoicesPerMonth: null, yearExport: true },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * The user's effective plan right now. PRO only counts while the subscription is
 * paid through (subscriptionExpiresAt in the future); this auto-downgrades to
 * FREE when a subscription lapses, even before the Stripe webhook fires.
 */
export function getEffectivePlan(
  user: { plan?: string | null; subscriptionExpiresAt?: Date | string | null },
  now: Date = new Date()
): Plan {
  if (user.plan === "pro" && user.subscriptionExpiresAt) {
    const expiresAt =
      user.subscriptionExpiresAt instanceof Date
        ? user.subscriptionExpiresAt
        : new Date(user.subscriptionExpiresAt);
    if (expiresAt.getTime() > now.getTime()) return "pro";
  }
  return "free";
}

// "YYYY-MM" key for a date, used to bucket monthly usage. UTC to stay stable
// across server timezones.
export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// First day of the month for a "YYYY-MM" key, and the first day of the next
// month — used for half-open [start, end) date-range queries.
export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const start = `${key}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { start, end };
}
