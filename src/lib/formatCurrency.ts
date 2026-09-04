// Money is represented as integer cents everywhere in the app (DB, API, state).
// The only conversions between euros and cents happen at the UI boundary:
//   - parseAmount:       user euro input  -> integer cents   (form submit)
//   - formatAmountInput: integer cents    -> "12,34" string  (prefill editable inputs)
//   - formatCurrency:    integer cents    -> "12,34 €" string (display, mit Tausenderpunkt)
// No floating-point arithmetic is performed on amounts after parseAmount.

/** Formats integer cents as a plain comma-decimal string, e.g. 1234 -> "12,34". */
export function formatAmountInput(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const euros = Math.trunc(abs / 100);
  const rem = abs % 100;
  return `${sign}${euros},${String(rem).padStart(2, "0")}`;
}

/**
 * Anzeigeformat mit Tausenderpunkt und nachgestelltem Symbol, wie es im
 * Deutschen üblich ist: 1234 -> "12,34 €", 123456789 -> "1.234.567,89 €",
 * -550 -> "-5,50 €". Vorher stand das Symbol vorn ("€12,34") und ab vier
 * Stellen fehlte jede Gruppierung — auf der Steuerseite unlesbar. Zwischen
 * Zahl und Symbol steht ein geschütztes Leerzeichen.
 */
export function formatCurrency(cents: number, currency: string = "€"): string {
  return `${formatAmountDisplay(cents)}\u00A0${currency}`;
}

/** Wie formatAmountInput, aber mit Tausenderpunkt: 123456789 -> "1.234.567,89". */
export function formatAmountDisplay(cents: number): string {
  const plain = formatAmountInput(cents);
  const sign = plain.startsWith("-") ? "-" : "";
  const [euros, rem] = plain.slice(sign.length).split(",");
  const grouped = euros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${rem}`;
}

/**
 * Parses a user-entered euro amount into integer cents, or `null` if the text
 * contains no usable number.
 *
 * Deutsche und englische Schreibweise werden beide verstanden:
 *   "12,34"      -> 1234      "12.34"     -> 1234
 *   "1.234,56"   -> 123456    "1,234.56"  -> 123456
 *   "1.234"      -> 123400    (Punkt vor genau drei Ziffern = Tausenderpunkt)
 *   "1,999"      -> 200       (Komma ist immer Dezimaltrenner, gerundet)
 *
 * Vorher ersetzte `.replace(",", ".")` nur das ERSTE Komma und ließ jeden
 * Punkt stehen: "1.234,56" wurde zu "1.234.56", `parseFloat` las 1.234 —
 * aus 1.234,56 € wurden 1,23 € in der EÜR, ohne Fehlermeldung.
 */
export function parseAmountOrNull(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,-]/g, "");
  const negative = cleaned.startsWith("-");
  const body = cleaned.replace(/-/g, "");
  if (!/\d/.test(body)) return null;

  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  let intPart: string;
  let fracPart: string;

  if (lastComma >= 0 && lastDot >= 0) {
    // Beide Zeichen: das letzte ist der Dezimaltrenner, das andere gruppiert.
    const sep = Math.max(lastComma, lastDot);
    intPart = body.slice(0, sep);
    fracPart = body.slice(sep + 1);
  } else if (lastComma >= 0) {
    if (body.indexOf(",") !== lastComma) {
      // "1,234,567" — englische Tausenderkommas ohne Dezimalteil.
      intPart = body;
      fracPart = "";
    } else {
      intPart = body.slice(0, lastComma);
      fracPart = body.slice(lastComma + 1);
    }
  } else if (lastDot >= 0) {
    const after = body.slice(lastDot + 1);
    if (body.indexOf(".") !== lastDot || (after.length === 3 && lastDot > 0)) {
      // "1.234.567" oder "1.234" — Tausenderpunkte, kein Dezimalteil.
      intPart = body;
      fracPart = "";
    } else {
      intPart = body.slice(0, lastDot);
      fracPart = after;
    }
  } else {
    intPart = body;
    fracPart = "";
  }

  const intDigits = intPart.replace(/[.,]/g, "");
  const fracDigits = fracPart.replace(/[.,]/g, "");
  if (!intDigits && !fracDigits) return null;

  const euros = intDigits ? Number(intDigits) : 0;
  // Nachkommastellen jenseits der zweiten werden gerundet ("1,999" -> 2,00).
  const fracCents = fracDigits ? Math.round(Number("0." + fracDigits) * 100) : 0;
  const cents = euros * 100 + fracCents;
  return negative ? -cents : cents;
}

/**
 * Wie `parseAmountOrNull`, liefert für unbrauchbare Eingaben aber 0. Für
 * Summen in laufenden Formularen (Zwischensumme beim Tippen); wer eine
 * Eingabe *abschickt*, nimmt `parseAmountOrNull` und lehnt `null` ab.
 */
export function parseAmount(text: string): number {
  return parseAmountOrNull(text) ?? 0;
}

/**
 * Anzeige eines Tagesdatums. `YYYY-MM-DD` (und ISO-Zeitstempel, deren Tag
 * genommen wird) werden per String-Slice formatiert — `new Date("2026-03-05")`
 * ist UTC-Mitternacht und zeigte westlich von UTC den Vortag. Andere
 * Eingaben fallen auf die Browser-Formatierung zurueck.
 */
export function formatDate(dateStr: string, locale: string = "de-DE"): string {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) {
    const [, y, mo, d] = m;
    return locale.startsWith("de") ? `${d}.${mo}.${y}` : `${Number(mo)}/${Number(d)}/${y}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale);
}
