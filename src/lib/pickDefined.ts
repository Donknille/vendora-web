/**
 * Übernimmt genau die Felder, die die Aufruferin gesetzt hat.
 *
 * Ein Update-Objekt aus einem PATCH/PUT trägt drei verschiedene Bedeutungen im
 * selben Feld: `undefined` heißt „nicht angefasst", ein Wert heißt „so setzen",
 * und `null`/`""` heißt „leeren". Die Speicherschicht hat das an drei Stellen
 * Feld für Feld ausgeschrieben — 14 Zeilen in `updateOrder`, 9 in
 * `updateMarket`, 6 in `updateSubscription`, alle nach demselben Muster.
 *
 * Der Unterschied zu einem `{ ...updates }`: der Spread würde ein `undefined`
 * mitschreiben und damit eine Spalte auf NULL setzen, die niemand anfassen
 * wollte. Deshalb wird gefiltert und nicht kopiert.
 *
 * Was hier **nicht** hineingehört, sind die Sonderfälle: `serviceDate: "" →
 * null`, das automatische Zahldatum beim Statuswechsel, das Neuableiten der
 * Marktkosten. Das ist Fachlogik, kein Abbilden von Feldern — sie bleibt an
 * der Aufrufstelle stehen, wo man sie liest.
 */
export function pickDefined<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[]
): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/**
 * Leerer String zu `null`, alles andere unverändert.
 *
 * Ein leeres Formularfeld kommt als `""` an, die Spalte ist aber nullable und
 * soll leer *sein*, nicht einen leeren String enthalten. Steht bewusst als
 * eigene Funktion neben `pickDefined`, statt darin versteckt zu sein: es
 * betrifft nur die Felder, die tatsächlich geleert werden können.
 */
export function emptyToNull<T>(value: T | "" | null | undefined): T | null {
  return value ? value : null;
}
