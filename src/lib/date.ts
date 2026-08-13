/**
 * Eine Quelle für Tagesdaten.
 *
 * `new Date().toISOString().slice(0, 10)` stand an 21 Stellen in 9 Dateien —
 * in der Speicherschicht, in drei API-Routen und in fünf Seiten. Jede davon
 * meinte dasselbe, keine sagte es.
 *
 * ## Achtung: das ist UTC, nicht Ortszeit
 *
 * `toISOString()` rechnet nach UTC um. In Deutschland (UTC+1/+2) liefert
 * `today()` zwischen Mitternacht und 01:00 bzw. 02:00 Ortszeit deshalb noch
 * den **Vortag**. Das betrifft das automatisch gesetzte Zahldatum eines
 * Auftrags, das Belegdatum einer Ausgabe und das Datum eines neuen Marktes.
 *
 * Das ist der Bestand, und dieses Modul bildet ihn absichtlich unverändert ab:
 * es zusammenzuführen ist ein Refactoring, es zu korrigieren wäre eine
 * fachliche Änderung an Zahlen, die in die EÜR laufen. Beides in einem Schritt
 * zu tun hieße, die Korrektur ungeprüft mitzuschmuggeln. Sie steht als eigener
 * Punkt in `docs/REFACTORING-PLAN.md`.
 *
 * Nicht hierher gehört die Datumsarithmetik der EÜR (`lib/euerReport.ts`):
 * die parst bewusst per String-Slice ohne `Date()`, weil ein `new Date("2026-01-01")`
 * je nach Zeitzone im Vorjahr landen kann. Diese Trennung ist per Guard gesichert.
 */

/** Der heutige Tag als ISO-Datum (`YYYY-MM-DD`), UTC — siehe Modulkommentar. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Der Tag eines `Date` als ISO-Datum (`YYYY-MM-DD`), UTC. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Der Tagesanteil eines bereits vorliegenden ISO-Strings.
 *
 * Verarbeitet beide Formen, die die API liefert: `date`-Spalten kommen als
 * `"2026-03-05"`, `timestamptz`-Spalten als `"2026-03-05T09:00:00.000Z"`.
 * Kein `Date()` im Spiel — der String wird nur beschnitten, es gibt also
 * keine Zeitzonenumrechnung und damit auch keine Verschiebung.
 */
export function dayOf(isoString: string): string {
  return isoString.slice(0, 10);
}
