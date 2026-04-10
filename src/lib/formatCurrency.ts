export function formatCurrency(amount: number, currency: string = "\u20AC"): string {
  return `${currency}${amount.toFixed(2).replace(".", ",")}`;
}

export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export function formatDate(dateStr: string, locale: string = "de-DE"): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale);
}
