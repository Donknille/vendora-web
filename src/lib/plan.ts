// Plan model (Phase 4). Pure and dependency-free so it is shared by server
// enforcement and client display and is trivially testable.
//
// Model (per product decision): new accounts get a TRIAL with full access for
// TRIAL_DAYS. After that, without an active PRO subscription (19.90 €/month) the
// account is FREE and READ-ONLY: existing data can be viewed and existing
// documents (invoice PDFs, DSGVO data export) can be re-downloaded at any time,
// but nothing new can be created — including generating the EÜR/GuV year
// overview.

export type Plan = "free" | "trial" | "pro";

// Length of the free trial for new accounts (days).
export const TRIAL_DAYS = 42;

// List price of Vendora Pro in cents. The authoritative amount charged is the
// Stripe Price behind STRIPE_PRICE_ID; this constant exists so the platform's
// own revenue can be reported without reading anything from user data.
export const PRO_PRICE_CENTS = 1990;

/** Whether the plan may create new records / generate the GuV. FREE is read-only. */
export function canCreate(plan: Plan): boolean {
  return plan === "pro" || plan === "trial";
}

/**
 * Whether a GuV/EÜR export for a given tax year is allowed: TRIAL/PRO may export
 * any year, and a FREE (read-only) account may still re-export a year it already
 * generated while it had access (`yearAlreadyExported`). New years stay locked.
 */
export function canExportYear(plan: Plan, yearAlreadyExported: boolean): boolean {
  return canCreate(plan) || yearAlreadyExported;
}

/**
 * The user's effective plan right now:
 *  - "pro"   while a paid subscription is paid through (subscriptionExpiresAt future),
 *  - "trial" while the initial trial is still running (trialEndsAt future),
 *  - "free"  otherwise (read-only).
 * Auto-downgrades as soon as the relevant date passes, even before any webhook.
 */
export function getEffectivePlan(
  user: {
    plan?: string | null;
    subscriptionExpiresAt?: Date | string | null;
    trialEndsAt?: Date | string | null;
  },
  now: Date = new Date()
): Plan {
  if (user.plan === "pro" && isFuture(user.subscriptionExpiresAt, now)) return "pro";
  if (isFuture(user.trialEndsAt, now)) return "trial";
  return "free";
}

/** Whole days from now until `date` (>=0), or null if no date / already passed. */
export function daysLeft(date: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  const ms = d.getTime() - now.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86400000);
}

function isFuture(date: Date | string | null | undefined, now: Date): boolean {
  if (!date) return false;
  const d = date instanceof Date ? date : new Date(date);
  return d.getTime() > now.getTime();
}
