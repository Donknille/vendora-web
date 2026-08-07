"use client";

import { queryClient } from "@/lib/api-client";

/**
 * Räumt alles ab, was auf diesem Gerät zum abgemeldeten Konto gehört.
 *
 * `queryClient.clear()` allein genügt nicht: der Service Worker hält
 * gerenderte Seiten im Cache. Auf einem geteilten Markt-Tablet reichte
 * bisher der Flugmodus, um nach einem Logout die Seite der Vorgängerin
 * wiederzusehen — der Server-Gate wird dabei nie erreicht, weil gar kein
 * Request hinausgeht.
 *
 * Wird beim Abmelden und beim Löschen des Kontos aufgerufen.
 */
export async function clearLocalData(): Promise<void> {
  queryClient.clear();

  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage("CLEAR_CACHE");
  }

  // Fallback, falls kein Service Worker die Kontrolle hat (erster Besuch,
  // deaktivierte Registrierung): direkt über die Cache-API räumen.
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // Cache-API nicht verfügbar (privater Modus) — nichts zu räumen.
    }
  }
}
