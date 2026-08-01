"use client";

import { useLanguage } from "@/lib/context/LanguageContext";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useStripeCheckout } from "@/lib/hooks/useStripeCheckout";

// Read-only nudge for FREE accounts (Phase 4.2): they can view and download
// everything but cannot create new records. Shown persistently until they
// upgrade to Pro. Never shown for PRO.
export function SubscriptionBanner() {
  const { language } = useLanguage();
  const { data: sub } = useSubscription();
  const { redirectToCheckout, loading } = useStripeCheckout();

  if (!sub || sub.plan !== "free") return null;

  const de = language === "de";

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
      <p className="text-sm text-amber-600">
        {de
          ? "Nur-Lese-Modus: Zum Anlegen neuer Einträge Vendora Pro (19,90 €/Monat). Ansehen und Exportieren bleibt frei."
          : "Read-only: Vendora Pro (€19.90/month) is required to create new entries. Viewing and exporting stay free."}
      </p>
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
