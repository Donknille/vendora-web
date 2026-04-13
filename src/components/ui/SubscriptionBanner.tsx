"use client";

import { useLanguage } from "@/lib/context/LanguageContext";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useStripeCheckout } from "@/lib/hooks/useStripeCheckout";

export function SubscriptionBanner() {
  const { t } = useLanguage();
  const { data: sub } = useSubscription();
  const { redirectToCheckout, loading } = useStripeCheckout();

  if (!sub) return null;

  if (sub.status === "trial" && sub.daysRemaining !== null) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
        <p className="text-sm text-yellow-500">
          {t.subscription.trialDaysLeft.replace("{days}", String(sub.daysRemaining))}
        </p>
        <button
          onClick={redirectToCheckout}
          disabled={loading}
          className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : t.subscription.upgrade}
        </button>
      </div>
    );
  }

  if (sub.status === "expired" || sub.status === "cancelled") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-red-400">{t.subscription.expired}</p>
          <p className="text-xs text-muted">{t.subscription.expiredSub}</p>
        </div>
        <button
          onClick={redirectToCheckout}
          disabled={loading}
          className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : t.subscription.upgrade}
        </button>
      </div>
    );
  }

  return null;
}
