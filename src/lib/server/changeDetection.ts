import "server-only";

/**
 * Welche Felder eines PUT den Bestand tatsaechlich aendern.
 *
 * Stand wortgleich in `orders/[id]/route.ts` und `markets/[id]/route.ts`.
 * Beide tragen dieselbe Regel: Ein reiner Statuswechsel legt nichts an und
 * bleibt fuer Free-Konten erlaubt (beim Markt ist er sogar der einzige Weg,
 * gebuchte Kosten wieder loszuwerden). Zwei Kopien dieser Regel driften —
 * und dann gilt die Ausnahme in einer Route und in der anderen nicht.
 *
 * Verglichen wird gegen den BESTAND, nicht gegen die Zahl der gesendeten
 * Schluessel: die Formulare schicken immer den ganzen Datensatz.
 */
export interface ChangeDetectionOptions<T> {
  /** Felder mit eigener Vergleichsregel (z. B. Positionen ohne id/orderId). */
  normalize?: Partial<Record<keyof T, (value: unknown) => string>>;
}

/** Leerwerte angleichen (null vs "" vs []), sonst zaehlt ein leeres Feld als Aenderung. */
export function normalizeEmpty(v: unknown): string {
  return JSON.stringify(Array.isArray(v) && v.length === 0 ? null : (v ?? null));
}

export function changedFields<T extends object>(
  next: T,
  current: Record<string, unknown>,
  opts: ChangeDetectionOptions<T> = {}
): (keyof T)[] {
  return (Object.keys(next) as (keyof T)[]).filter((key) => {
    const value = next[key];
    if (value === undefined) return false;
    const before = current[key as string];
    const norm = opts.normalize?.[key] ?? normalizeEmpty;
    return norm(value) !== norm(before);
  });
}

/** Leere Menge = unveraendertes Speichern; legt nichts an, wird nicht gesperrt. */
export function isStatusOnlyChange<T>(changed: (keyof T)[]): boolean {
  return changed.every((key) => key === "status");
}
