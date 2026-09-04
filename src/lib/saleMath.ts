/**
 * Eine Rechenregel für den Wert einer Verkaufszeile.
 *
 * Fünf Stellen rechneten `amount × quantity` je auf eigene Weise: EÜR und
 * Ranking nahmen `quantity || 1`, Tagesabschluss, Marktkarte und
 * Jahresvergleich `quantity || 0`, die Marktseite gar keinen Rückfall. Für
 * eine Zeile mit fehlender Menge (denkbar nach einem alten Restore) hätten
 * Kassenabschluss und Steuerreport verschiedene Summen für denselben Markt
 * gezeigt. Die Regel ist die der EÜR: eine Verkaufszeile ist mindestens ein
 * Stück.
 */
export interface SaleLine {
  amount: number | string | null | undefined; // Cent je Stück
  quantity: number | string | null | undefined;
}

/** Stückzahl einer Zeile — fehlend oder 0 zählt als 1. */
export function saleQuantity(sale: Pick<SaleLine, "quantity">): number {
  return Number(sale.quantity) || 1;
}

/** Zeilenwert in Cent: Einzelbetrag × Stückzahl. */
export function saleLineTotal(sale: SaleLine): number {
  return (Number(sale.amount) || 0) * saleQuantity(sale);
}

/** Summe mehrerer Zeilen in Cent. */
export function sumSaleLines(sales: readonly SaleLine[]): number {
  return sales.reduce((sum, s) => sum + saleLineTotal(s), 0);
}
