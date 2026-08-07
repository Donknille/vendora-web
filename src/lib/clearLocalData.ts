"use client";

import { queryClient } from "@/lib/api-client";
import { OFFLINE_CACHE_KEY } from "@/lib/offlineCache";

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

  // Der persistierte Marktmodus-Puffer liegt in localStorage und wuerde einen
  // Kontowechsel sonst ueberleben.
  try {
    window.localStorage.removeItem(OFFLINE_CACHE_KEY);
  } catch {
    // localStorage nicht verfuegbar (privater Modus) — nichts zu raeumen.
  }

  // Die Offline-Verkaufsqueue ist nicht kontogebunden: sie laege sonst nach
  // einem Kontowechsel mit Bezeichnung, Betrag und Uhrzeit fremder Verkaeufe
  // weiter im Browser -- auf einem geteilten Markt-Tablet unbegrenzt.
  if (typeof indexedDB !== "undefined") {
    try {
      indexedDB.deleteDatabase("vendora-offline");
    } catch {
      // IndexedDB nicht verfuegbar — nichts zu raeumen.
    }
  }

  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage("CLEAR_CACHE");
  }

  // Fallback, falls kein Service Worker die Kontrolle hat (erster Besuch,
  // deaktivierte Registrierung): direkt über die Cache-API räumen.
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys();
      // Precache (Offline-Seite, Icons) bleibt: er wird nur beim install-Event
      // des Service Workers befuellt und waere sonst dauerhaft weg.
      await Promise.all(
        keys.filter((key) => !key.startsWith("vendora-precache")).map((key) => caches.delete(key)),
      );
    } catch {
      // Cache-API nicht verfügbar (privater Modus) — nichts zu räumen.
    }
  }
}
