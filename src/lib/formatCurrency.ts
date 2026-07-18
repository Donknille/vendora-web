// Money is represented as integer cents everywhere in the app (DB, API, state).
// The only conversions between euros and cents happen at the UI boundary:
//   - parseAmount:       user euro input  -> integer cents   (form submit)
//   - formatAmountInput: integer cents    -> "12,34" string  (prefill editable inputs)
//   - formatCurrency:    integer cents    -> "€12,34" string  (display)
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

/** Formats integer cents with a currency symbol, e.g. 1234 -> "€12,34". */
export function formatCurrency(cents: number, currency: string = "€"): string {
  return `${currency}${formatAmountInput(cents)}`;
}

/** Parses a user-entered euro amount (e.g. "12,34" or "€12.34") into integer cents. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.,-]/g, "").replace(",", ".");
  const euros = parseFloat(cleaned);
  return isNaN(euros) ? 0 : Math.round(euros * 100);
}

export function formatDate(dateStr: string, locale: string = "de-DE"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale);
}
