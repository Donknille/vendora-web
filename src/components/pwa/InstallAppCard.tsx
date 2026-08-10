"use client";

import { Check, Download, Share, Smartphone } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useInstallPrompt } from "@/lib/hooks/useInstallPrompt";
import { Card } from "@/components/ui/Card";

/**
 * „Als App installieren" — in den Einstellungen und auf der Hilfeseite.
 *
 * Manifest, Icons und Service Worker gibt es längst; sichtbar war der Weg
 * dorthin nie. Wie er aussieht, hängt am Browser: Chromium liefert ein
 * Installationsereignis, Safari auf iOS grundsätzlich keines — dort bleibt nur
 * die Anleitung übers Teilen-Menü.
 */
export function InstallAppCard() {
  const { t } = useLanguage();
  const { platform, install } = useInstallPrompt();
  const copy = t.help.install;

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <Smartphone className="h-5 w-5 text-brand-primary" />
        <h2 className="text-base font-semibold text-primary">{copy.title}</h2>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-faint">{copy.body}</p>

      {platform === "prompt" && (
        <button
          onClick={() => void install()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
        >
          <Download className="h-4 w-4" />
          {copy.action}
        </button>
      )}

      {platform === "ios" && (
        <div className="rounded-lg border border-line bg-elevated p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-secondary">
            <Share className="h-4 w-4 text-brand-primary" />
            {copy.iosTitle}
          </p>
          <ol className="space-y-2">
            {copy.iosSteps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-faint">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {platform === "installed" && (
        <p className="inline-flex items-center gap-2 text-sm font-medium text-green-600">
          <Check className="h-4 w-4" />
          {copy.installed}
        </p>
      )}

      {platform === "unsupported" && (
        <p className="text-sm text-muted">{copy.unsupported}</p>
      )}
    </Card>
  );
}
