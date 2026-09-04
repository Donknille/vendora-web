"use client";

/**
 * Persistenz des Abfrage-Caches für den Marktmodus.
 *
 * `offline.html` verspricht wörtlich: „Der Marktmodus funktioniert auch ohne
 * Netz." Erfasste Verkäufe lagen zwar immer sicher in der IndexedDB-Queue —
 * aber nach einem Kaltstart in einer Markthalle ohne Empfang ließ sich die
 * Kasse gar nicht erst öffnen: der Abfrage-Cache lebte nur im Speicher, also
 * fehlten Marktname, Preise und Schnellwahl-Artikel.
 *
 * Persistiert wird deshalb genau so viel, wie die Kasse zum Starten braucht,
 * und nichts darüber hinaus:
 *  - die Marktliste (Name, Datum, Kosten, quickItems)
 *  - die Verkäufe des jeweiligen Marktes (für den Tagesabschluss)
 *
 * Bewusst NICHT persistiert werden Aufträge, Ausgaben, Rechnungen, Profil und
 * Abo-Status: Geldbeträge und Kundendaten, die nach einem Tag im Zweifel falsch
 * sind, gehören nicht in den Gerätespeicher. Alles wird beim Abmelden und beim
 * Löschen des Kontos entfernt (`clearLocalData`).
 */

import type { Query } from "@tanstack/react-query";

export const OFFLINE_CACHE_KEY = "bilanz-buddy-offline-cache";

/** Eine Woche: deckt eine Marktsaison-Woche ab, ohne ewig alte Stände zu halten. */
export const OFFLINE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Welche Abfragen auf dem Gerät liegen dürfen. */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const url = queryKey.find(
    (k): k is string => typeof k === "string" && k.startsWith("/api/"),
  );
  if (!url) return false;

  // Marktliste UND die Verkaeufe eines Marktes: deren Schluessel ist
  // [userId, "/api/markets", marketId, "sales"] (useMarketSales), das erste
  // /api/-Segment ist also ebenfalls "/api/markets".
  return url === "/api/markets";
}

export function dehydrateFilter(query: Query): boolean {
  return query.state.status === "success" && shouldPersistQuery(query.queryKey);
}
