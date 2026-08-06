// Pure EÜR (Einnahmen-Überschuss-Rechnung) computation, shared by the /steuer
// view and the server-side export. Cash-basis (Zuflussprinzip):
//   - order income is recognised on paidAt (fallback orderDate) for paid-like orders
//   - market sales are recognised on the market day (fallback the sale timestamp)
//   - expenses are recognised on expenseDate (incl. derived market cost rows)
// All amounts are integer cents.

import type { Order, MarketEvent, MarketSale, Expense } from "@/lib/types";
import { isPaidLike } from "@/lib/orderStatus";
import { DEFAULT_EUER_CATEGORY, isEuerCategory, type EuerCategory } from "@/lib/euer";

export type EuerLineKind = "income_order" | "income_market" | "expense";

export interface EuerLine {
  date: string; // YYYY-MM-DD (Zufluss-/Belegdatum)
  kind: EuerLineKind;
  description: string;
  category: EuerCategory | null; // set for expenses; null for income
  amount: number; // cents (positive)
}

export interface EuerReport {
  year: number;
  incomeTotal: number;
  expenseTotal: number;
  surplus: number;
  incomeByMonth: number[]; // length 12
  expenseByMonth: number[]; // length 12
  expensesByCategory: { category: EuerCategory; amount: number }[]; // desc by amount
  lines: EuerLine[]; // asc by date
}

export interface EuerInput {
  year: number;
  orders: Order[];
  markets: MarketEvent[];
  marketSales: MarketSale[];
  expenses: Expense[]; // reporting expenses (incl. derived market costs)
}

/** Same data as EuerInput, without committing to a single year. */
export type EuerData = Omit<EuerInput, "year">;

/** One month of one year — never merged across years (the key carries both). */
export interface EuerMonthRow {
  key: string; // "YYYY-MM"
  year: number;
  monthIndex: number; // 0-11
  income: number;
  expenses: number;
  surplus: number;
}

/**
 * Several yearly reports rolled into one view (the dashboard's "all years").
 *
 * Deliberately built *from* EuerReport instead of re-implementing the booking
 * rules: `incomeByMonth[12]` cannot be added across years, so the months are
 * unfolded into rows keyed by year+month first.
 */
export interface EuerAggregate {
  years: number[]; // asc
  incomeTotal: number;
  expenseTotal: number;
  surplus: number;
  expensesByCategory: { category: EuerCategory; amount: number }[]; // desc by amount
  months: EuerMonthRow[]; // asc by key, only months with movement
}

// Parse a leading YYYY-MM from a date string ("2026-07-18" or full ISO) without
// going through Date() (avoids timezone drift on date-only strings).
function parseYearMonth(dateStr: string | null | undefined): { year: number; monthIndex: number } | null {
  if (!dateStr || dateStr.length < 7) return null;
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

function day(dateStr: string): string {
  return dateStr.length >= 10 ? dateStr.slice(0, 10) : dateStr;
}

export function orderIncomeDate(order: Pick<Order, "paidAt" | "orderDate">): string {
  return order.paidAt || order.orderDate;
}

export function computeEuerReport(input: EuerInput): EuerReport {
  const { year } = input;
  const incomeByMonth = new Array(12).fill(0);
  const expenseByMonth = new Array(12).fill(0);
  const categoryTotals = new Map<EuerCategory, number>();
  const lines: EuerLine[] = [];
  let incomeTotal = 0;
  let expenseTotal = 0;

  // ── Orders (Zufluss = paidAt, sonst orderDate) ──
  for (const order of input.orders) {
    if (!isPaidLike(order.status)) continue;
    const dateStr = orderIncomeDate(order);
    const ym = parseYearMonth(dateStr);
    if (!ym || ym.year !== year) continue;
    const amount = order.total || 0;
    incomeTotal += amount;
    incomeByMonth[ym.monthIndex] += amount;
    lines.push({
      date: day(dateStr),
      kind: "income_order",
      description: order.invoiceNumber
        ? `${order.invoiceNumber} · ${order.customerName || ""}`.trim()
        : order.customerName || "Auftrag",
      category: null,
      amount,
    });
  }

  // ── Market sales (Zufluss = Markttag) ──
  const marketById = new Map(input.markets.map((m) => [m.id, m]));
  for (const sale of input.marketSales) {
    const market = marketById.get(sale.marketId);
    const dateStr = market?.date || sale.createdAt;
    const ym = parseYearMonth(dateStr);
    if (!ym || ym.year !== year) continue;
    const amount = (sale.amount || 0) * (sale.quantity || 1);
    incomeTotal += amount;
    incomeByMonth[ym.monthIndex] += amount;
    lines.push({
      date: day(dateStr),
      kind: "income_market",
      description: market ? `${market.name}: ${sale.description}` : sale.description || "Marktverkauf",
      category: null,
      amount,
    });
  }

  // ── Expenses (Belegdatum) ──
  for (const expense of input.expenses) {
    const ym = parseYearMonth(expense.expenseDate);
    if (!ym || ym.year !== year) continue;
    const amount = expense.amount || 0;
    const category: EuerCategory = isEuerCategory(expense.category) ? expense.category : DEFAULT_EUER_CATEGORY;
    expenseTotal += amount;
    expenseByMonth[ym.monthIndex] += amount;
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
    lines.push({
      date: day(expense.expenseDate),
      kind: "expense",
      description: expense.description || "",
      category,
      amount,
    });
  }

  lines.sort((a, b) => a.date.localeCompare(b.date));
  const expensesByCategory = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    year,
    incomeTotal,
    expenseTotal,
    surplus: incomeTotal - expenseTotal,
    incomeByMonth,
    expenseByMonth,
    expensesByCategory,
    lines,
  };
}

/** One report per year, all from the same data set. */
export function computeEuerReports(data: EuerData, years: number[]): EuerReport[] {
  return years.map((year) => computeEuerReport({ ...data, year }));
}

/**
 * Roll several yearly reports into one aggregate. The only place the app is
 * allowed to combine years — everything it returns comes from computeEuerReport.
 */
export function aggregateEuerReports(reports: EuerReport[]): EuerAggregate {
  const categoryTotals = new Map<EuerCategory, number>();
  const months: EuerMonthRow[] = [];
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const report of reports) {
    incomeTotal += report.incomeTotal;
    expenseTotal += report.expenseTotal;
    for (const { category, amount } of report.expensesByCategory) {
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
    }
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const income = report.incomeByMonth[monthIndex] || 0;
      const expenses = report.expenseByMonth[monthIndex] || 0;
      if (income === 0 && expenses === 0) continue;
      months.push({
        key: `${report.year}-${String(monthIndex + 1).padStart(2, "0")}`,
        year: report.year,
        monthIndex,
        income,
        expenses,
        surplus: income - expenses,
      });
    }
  }

  months.sort((a, b) => a.key.localeCompare(b.key));
  const expensesByCategory = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  return {
    years: Array.from(new Set(reports.map((r) => r.year))).sort((a, b) => a - b),
    incomeTotal,
    expenseTotal,
    surplus: incomeTotal - expenseTotal,
    expensesByCategory,
    months,
  };
}

/**
 * The years that actually carry bookings, newest first — using the same dating
 * rules as the report (Zufluss for orders, market day for sales). A year that
 * only holds unpaid orders is not a reporting year and is left out.
 */
export function euerAvailableYears(data: EuerData, opts?: { includeYear?: number }): number[] {
  const years = new Set<number>();
  const add = (dateStr: string | null | undefined) => {
    const ym = parseYearMonth(dateStr);
    if (ym) years.add(ym.year);
  };

  for (const order of data.orders) {
    if (!isPaidLike(order.status)) continue;
    add(orderIncomeDate(order));
  }
  const marketById = new Map(data.markets.map((m) => [m.id, m]));
  for (const sale of data.marketSales) {
    add(marketById.get(sale.marketId)?.date || sale.createdAt);
  }
  for (const expense of data.expenses) add(expense.expenseDate);
  if (opts?.includeYear !== undefined) years.add(opts.includeYear);

  return Array.from(years).sort((a, b) => b - a);
}
