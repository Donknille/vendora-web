"use client";

import { useLanguage } from "@/lib/context/LanguageContext";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useStripeCheckout } from "@/lib/hooks/useStripeCheckout";

// Free-plan nudge: only shown once a monthly limit is reached (no nagging while
// the user is comfortably within limits, and never for PRO). Phase 4.1.
export function SubscriptionBanner() {
  const { language } = useLanguage();
  const { data: sub } = useSubscription();
  const { redirectToCheckout, loading } = useStripeCheckout();

  if (!sub || sub.plan !== "free") return null;

  const { limits, usage } = sub;
  const marketsReached =
    limits.marketsPerMonth !== null && usage.marketsThisMonth >= limits.marketsPerMonth;
  const invoicesReached =
    limits.invoicesPerMonth !== null && usage.invoicesThisMonth >= limits.invoicesPerMonth;

  if (!marketsReached && !invoicesReached) return null;

  const de = language === "de";
  const msg = marketsReached
    ? de
      ? `Free-Limit erreicht: ${limits.marketsPerMonth} Märkte diesen Monat.`
      : `Free limit reached: ${limits.marketsPerMonth} markets this month.`
    : de
      ? `Free-Limit erreicht: ${limits.invoicesPerMonth} Rechnungen diesen Monat.`
      : `Free limit reached: ${limits.invoicesPerMonth} invoices this month.`;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <p className="text-sm text-amber-600">{msg}</p>
      <button
        onClick={redirectToCheckout}
        disabled={loading}
        className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "..." : de ? "Auf Pro upgraden" : "Upgrade to Pro"}
      </button>
    </div>
  );
}
