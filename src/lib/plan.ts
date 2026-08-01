// Plan model (Phase 4). Pure and dependency-free so it is shared by server
// enforcement and client display and is trivially testable.
//
// Model (per product decision): PRO is a single 19.90 €/month subscription that
// unlocks everything. Without an active subscription the account is FREE and
// READ-ONLY: existing data can be viewed and downloaded/exported at any time,
// but no new records can be created.

export type Plan = "free" | "pro";

/** Whether the plan may create new records. FREE is read-only. */
export function canCreate(plan: Plan): boolean {
  return plan === "pro";
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
