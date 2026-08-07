"use client";

import type { Language } from "@/lib/prefs";

/**
 * Übersetzt eine fehlgeschlagene API-Antwort in einen Satz, der der Nutzerin
 * weiterhilft.
 *
 * `apiRequest` wirft einen Error, dessen `message` die Server-Meldung trägt.
 * Die catch-Blöcke haben diese Begründung bisher weggeworfen und stattdessen
 * einen pauschalen Text gesetzt — ein 403 „Vendora Pro nötig" erschien beim
 * Bearbeiten eines Auftrags als „Fehlende Angaben", und man suchte ein
 * Pflichtfeld, das es nicht gab.
 */
export function apiErrorMessage(
  error: unknown,
  language: Language,
  fallback: string,
): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;

  // Der Server schickt bei gesperrten Schreibzugriffen einen deutschen Satz mit.
  // Für die englische Oberfläche wird er hier übersetzt statt durchgereicht.
  if (message.includes("Vendora Pro")) {
    return language === "de"
      ? "Dafür wird Vendora Pro benötigt. Ansehen und Herunterladen bleibt möglich."
      : "This requires Vendora Pro. Viewing and downloading stay available.";
  }

  return message;
}
