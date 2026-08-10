"use client";

import Link from "next/link";
import { Download, Smartphone, X } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { useLocalFlag } from "@/lib/hooks/useLocalFlag";
import { INSTALL_HINT_DISMISSED_KEY, shouldShowInstallHint } from "@/lib/pwaInstall";

/**
 * Der einmalige Hinweis im Dashboard.
 *
 * Er erscheint erst, wenn tatsächlich etwas angelegt wurde — davor zeigt das
 * Dashboard seine Willkommenskarte, und zwei Kästen übereinander wären einer zu
 * viel. Weggeklickt heißt endgültig weg; das merkt sich localStorage, denn
 * anders als bei der Erklärung geht es hier um dieses eine Gerät.
 */
export function InstallHint({ hasData }: { hasData: boolean }) {
  const { t } = useLanguage();
  const { platform, install } = useInstallPrompt();
  // fallback = true: ohne lesbaren Speicher (privater Modus) käme der Hinweis
  // bei jedem Laden wieder — dann lieber gar nicht.
  const dismissed = useLocalFlag(INSTALL_HINT_DISMISSED_KEY, true);

  if (!shouldShowInstallHint({ platform, dismissed: dismissed.isSet, hasData })) return null;

  const copy = t.help.install;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
      <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">{copy.hintTitle}</p>
        <p className="mt-0.5 text-sm text-faint">{copy.hintBody}</p>

        {platform === "prompt" ? (
          <button
            onClick={() => void install()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90"
          >
            <Download className="h-4 w-4" />
            {copy.hintAction}
          </button>
        ) : (
          // iOS: es gibt nichts zu klicken, nur die Anleitung auf der Hilfeseite.
          <Link
            href="/hilfe"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
          >
            {copy.hintHow} →
          </Link>
        )}
      </div>

      <button
        onClick={dismissed.set}
        className="-mr-1 -mt-1 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-secondary"
        aria-label={copy.dismiss}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
