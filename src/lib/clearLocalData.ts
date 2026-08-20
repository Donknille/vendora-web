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
 * Wird beim Abmelden und beim Löschen des Kontos aufgerufen. Die
 * Offline-Verkaufsqueue wird nur im zweiten Fall geleert (`deleteSalesQueue`).
 */
export async function clearLocalData(
  { deleteSalesQueue = false }: { deleteSalesQueue?: boolean } = {},
): Promise<void> {
  queryClient.clear();

  // Der persistierte Marktmodus-Puffer liegt in localStorage und wuerde einen
  // Kontowechsel sonst ueberleben.
  try {
    window.localStorage.removeItem(OFFLINE_CACHE_KEY);
    window.localStorage.removeItem("bilanz-buddy-last-register");
  } catch {
    // localStorage nicht verfuegbar (privater Modus) — nichts zu raeumen.
  }

  // Die Verkaufsqueue NUR beim Loeschen des Kontos. Beim normalen Abmelden
  // waere das Datenverlust: dort liegen noch nicht bestaetigte Verkaeufe --
  // Bargeld, das am Stand eingenommen wurde. Wer sich in der Markthalle ohne
  // Empfang abmeldet, haette sie sonst wortlos verloren, obwohl die Kasse
  // ausdruecklich zusagt, dass nichts verlorengeht.
  if (deleteSalesQueue && typeof indexedDB !== "undefined") {
    try {
      indexedDB.deleteDatabase("bilanz-buddy-offline");
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
        keys.filter((key) => !key.startsWith("bilanz-buddy-precache")).map((key) => caches.delete(key)),
      );
    } catch {
      // Cache-API nicht verfügbar (privater Modus) — nichts zu räumen.
    }
  }
}
