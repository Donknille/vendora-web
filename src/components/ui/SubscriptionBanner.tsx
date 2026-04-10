"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useSubscription } from "@/lib/hooks/useSubscription";

export function SubscriptionBanner() {
  const { t } = useLanguage();
  const { data: sub } = useSubscription();

  if (!sub) return null;

  if (sub.status === "trial" && sub.daysRemaining !== null) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
        <p className="text-sm text-yellow-500">
          {t.subscription.trialDaysLeft.replace(
            "{days}",
            String(sub.daysRemaining)
          )}
        </p>
        <Link
          href="/settings"
          className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          {t.subscription.upgrade}
        </Link>
      </div>
    );
  }

  if (sub.status === "expired" || sub.status === "cancelled") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-red-400">
            {t.subscription.expired}
          </p>
          <p className="text-xs text-muted">{t.subscription.expiredSub}</p>
        </div>
        <Link
          href="/settings"
          className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          {t.subscription.upgrade}
        </Link>
      </div>
    );
  }

  return null;
}
