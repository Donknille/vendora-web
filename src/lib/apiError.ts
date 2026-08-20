"use client";

import type { Language } from "@/lib/prefs";
import { APP_NAME_PRO } from "@/lib/brand";

/**
 * Übersetzt eine fehlgeschlagene API-Antwort in einen Satz, der der Nutzerin
 * weiterhilft.
 *
 * Übersetzt werden ausschließlich BEKANNTE Fehlercodes. Alles andere fällt auf
 * den lokalisierten Standardtext zurück — eine Server-Meldung ungeprüft
 * anzuzeigen hieße, „Validation error", „Unauthorized" oder
 * „Billing is not configured" in die Oberfläche durchzureichen: englisch,
 * nichtssagend und teilweise interne Information.
 *
 * Der Anlass: ein 403 „Bilanz-Buddy Pro nötig" erschien beim Bearbeiten eines
 * Auftrags als „Fehlende Angaben" — man suchte ein Pflichtfeld, das es nicht
 * gab.
 */
export function apiErrorMessage(
  error: unknown,
  language: Language,
  fallback: string,
): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  const de = language === "de";

  switch (code) {
    case "PRO_REQUIRED":
      return de
        ? `Dafür wird ${APP_NAME_PRO} benötigt. Ansehen und Herunterladen bleibt möglich.`
        : `This requires ${APP_NAME_PRO}. Viewing and downloading stay available.`;
    case "ALREADY_PRO":
      return de
        ? "Dieses Konto hat bereits ein aktives Abo."
        : "This account already has an active subscription.";
    case "DERIVED_EXPENSE":
      return de
        ? "Diese Ausgabe gehört zu einem Markt und lässt sich nur dort ändern."
        : "This expense belongs to a market and can only be changed there.";
    case "PROFILE_INCOMPLETE":
      return de
        ? "Im Firmenprofil fehlen Name und Anschrift."
        : "Your company profile is missing name and address.";
    default:
      return fallback;
  }
}
