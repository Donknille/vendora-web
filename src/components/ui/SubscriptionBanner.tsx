"use client";

import { useLanguage } from "@/lib/context/LanguageContext";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useStripeCheckout } from "@/lib/hooks/useStripeCheckout";

// Plan nudge (Phase 4): a gentle trial-countdown while the trial runs, and a
// persistent read-only prompt once it has expired (FREE). Never shown for PRO.
export function SubscriptionBanner() {
  const { language } = useLanguage();
  const { data: sub } = useSubscription();
  const { redirectToCheckout, loading } = useStripeCheckout();

  if (!sub || sub.plan === "pro") return null;

  const de = language === "de";
  const isTrial = sub.plan === "trial";

  const wrapClass = isTrial
    ? "border-brand-primary/20 bg-brand-primary/5"
    : "border-amber-500/20 bg-amber-500/5";
  const textClass = isTrial ? "text-secondary" : "text-amber-600";

  const message = isTrial
    ? de
      ? `Testphase: noch ${sub.trialDaysLeft ?? 0} Tag(e) mit vollem Zugriff.`
      : `Trial: ${sub.trialDaysLeft ?? 0} day(s) of full access left.`
    : de
      ? "Nur-Lese-Modus: Zum Anlegen und für die GuV Vendora Pro (19,90 €/Monat). Belege bleiben herunterladbar."
      : "Read-only: Vendora Pro (€19.90/month) is required to create entries and the P&L. Existing documents stay downloadable.";

  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${wrapClass}`}>
      <p className={`text-sm ${textClass}`}>{message}</p>
      <button
        onClick={redirectToCheckout}
        disabled={loading}
        className="shrink-0 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "..." : de ? "Pro holen" : "Get Pro"}
      </button>
    </div>
  );
}
