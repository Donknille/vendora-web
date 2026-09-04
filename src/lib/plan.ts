// Plan model (Phase 4). Pure and dependency-free so it is shared by server
// enforcement and client display and is trivially testable.
//
// Model (per product decision): new accounts get a TRIAL with full access for
// TRIAL_DAYS. After that, without an active PRO subscription (9.99 €/month) the
// account is FREE and READ-ONLY: existing data can be viewed and existing
// documents (invoice PDFs, DSGVO data export) can be re-downloaded at any time,
// but nothing new can be created — including generating the EÜR/GuV year
// overview.

export type Plan = "free" | "trial" | "pro";

// Length of the free trial for new accounts (days).
export const TRIAL_DAYS = 42;

// Bruttopreis von Bilanz-Buddy Pro in Cent — der Betrag, den die Kundin zahlt
// und der in der Oberflaeche steht. Abgerechnet wird der Stripe-Price hinter
// STRIPE_PRICE_ID; diese Konstante ist die Quelle fuer Anzeige und eigene
// Umsatzzahlen, ohne dafuer Nutzerdaten zu lesen.
export const PRO_PRICE_CENTS = 999;

// Umsatzsteuer auf die Abo-Leistung (Regelsteuersatz). Seit dem Verzicht auf
// die Kleinunternehmerregelung ist sie im Preis enthalten und wird abgefuehrt.
export const VAT_RATE = 0.19;

/**
 * Nettoanteil des Bruttopreises in Cent.
 *
 * Die Umsatzsteuer ist ein durchlaufender Posten: der eigene Erloes ist der
 * Nettoanteil, nicht der Zahlbetrag. Gerundet wie Stripe bei
 * `tax_behavior: "inclusive"` — 999 / 1,19 = 839,50 → 839, Steueranteil 160.
 */
export const PRO_PRICE_NET_CENTS = Math.round(PRO_PRICE_CENTS / (1 + VAT_RATE));

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
