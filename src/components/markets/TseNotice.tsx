"use client";

import { Info, CreditCard, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";

// Referral target is configured per environment (Phase 4 formalises referral
// slots). Falls back to the SumUp homepage so the slot is never a dead link.
const SUMUP_URL =
  process.env.NEXT_PUBLIC_SUMUP_REFERRAL_URL || "https://www.sumup.com/de-de/";

/**
 * Clarifies that Bilanz-Buddy is NOT a cash register with a TSE (§146a AO) and points
 * to a card-reader partner. The partner link is marked "Anzeige" (UWG). No user
 * data is sent to the partner.
 */
export function TseNotice() {
  const { language } = useLanguage();
  const de = language === "de";

  return (
    <div className="rounded-lg border border-line bg-elevated p-3 text-xs text-faint">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <p>
          {de
            ? "Bilanz-Buddy ist keine TSE-Registrierkasse (§ 146a AO). Der Marktmodus erfasst deine Verkäufe für die EÜR – für kassensturzpflichtige Bargeschäfte mit TSE nutze eine zertifizierte Kasse."
            : "Bilanz-Buddy is not a certified cash register (TSE). Market mode records your sales for the income statement – for TSE-compliant cash handling use a certified register."}
        </p>
      </div>
      <a
        href={SUMUP_URL}
        target="_blank"
        rel="noopener noreferrer nofollow sponsored"
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 font-medium text-secondary hover:border-brand-primary hover:text-primary transition-colors"
      >
        <CreditCard className="h-3.5 w-3.5" />
        {de ? "Kartenleser: SumUp entdecken" : "Card reader: discover SumUp"}
        <ExternalLink className="h-3 w-3" />
        <span className="ml-1 rounded bg-elevated px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {de ? "Anzeige" : "Ad"}
        </span>
      </a>
    </div>
  );
}
