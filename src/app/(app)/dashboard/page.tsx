"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { euerLabel, isEuerCategory } from "@/lib/euer";
import { escapeHtml } from "@/lib/escapeHtml";
import { useProfile } from "@/lib/hooks/useProfile";
import { Card } from "@/components/ui/Card";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import type { Order, Expense, MarketEvent, MarketSale } from "@/lib/types";

// Charts are client-only (recharts needs the DOM); avoids SSR/hydration churn.
const MonthlyChart = dynamic(
  () => import("@/components/MonthlyChart").then((m) => m.MonthlyChart),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the year from an ISO-like date string (e.g. "2025-03-15" or full ISO). */
function yearOf(dateStr: string | undefined | null): number | null {
  if (!dateStr) return null;
  const y = new Date(dateStr).getFullYear();
  return Number.isNaN(y) ? null : y;
}

/** Build a "YYYY-MM" key from a date string. */
function monthKey(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const userId = useCurrentUserId();
  const { data: profile } = useProfile();
  // Single batched API call instead of 4 separate ones
  const { data, isLoading } = useQuery<{
    orders: Order[];
    expenses: Expense[];
    markets: MarketEvent[];
    marketSales: MarketSale[];
  }>({ queryKey: [userId, "/api/dashboard"], enabled: !!userId });

  const orders = data?.orders;
  const expenses = data?.expenses;
  const markets = data?.markets;
  const marketSales = data?.marketSales;

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // ----- Collect available years -----
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    (orders ?? []).forEach((o) => {
      const y = yearOf(o.orderDate ?? o.createdAt);
      if (y) yearSet.add(y);
    });
    (expenses ?? []).forEach((e) => {
      const y = yearOf(e.expenseDate ?? e.createdAt);
      if (y) yearSet.add(y);
    });
    (marketSales ?? []).forEach((s) => {
      const y = yearOf(s.createdAt);
      if (y) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [orders, expenses, marketSales]);

  // ----- Filter helpers -----
  const matchesYear = (dateStr: string | undefined | null): boolean => {
    if (selectedYear === null) return true;
    return yearOf(dateStr) === selectedYear;
  };

  // ----- Paid orders (filtered) -----
  const paidOrders = useMemo(
    () =>
      (orders ?? []).filter(
        (o) => (o.status === "paid" || o.status === "shipped" || o.status === "delivered") && matchesYear(o.orderDate ?? o.createdAt),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, selectedYear],
  );

  // ----- Market sales (filtered) -----
  const filteredSales = useMemo(
    () => (marketSales ?? []).filter((s) => matchesYear(s.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketSales, selectedYear],
  );

  // ----- Expenses (filtered) -----
  const filteredExpenses = useMemo(
    () =>
      (expenses ?? []).filter((e) =>
        matchesYear(e.expenseDate ?? e.createdAt),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, selectedYear],
  );

  // ----- KPIs -----
  const totalRevenue = useMemo(() => {
    const orderRev = paidOrders.reduce((sum: number, o) => sum + (Number(o.total) || 0), 0);
    const salesRev = filteredSales.reduce(
      (sum: number, s) => sum + (Number(s.amount) || 0) * (Number(s.quantity) || 1),
      0,
    );
    return orderRev + salesRev;
  }, [paidOrders, filteredSales]);

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum: number, e) => sum + (Number(e.amount) || 0), 0),
    [filteredExpenses],
  );

  const netProfit = totalRevenue - totalExpenses;

  // ----- Quick stats (always unfiltered) -----
  const openOrdersCount = (orders ?? []).filter((o) => o.status === "open").length;
  const paidOrdersCount = (orders ?? []).filter((o) => o.status === "paid" || o.status === "shipped" || o.status === "delivered").length;
  const marketsCount = (markets ?? []).length;

  // ----- Monthly performance data -----
  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; expenses: number }> = {};

    paidOrders.forEach((o) => {
      const mk = monthKey(o.orderDate ?? o.createdAt);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, expenses: 0 };
      map[mk].revenue += Number(o.total) || 0;
    });

    filteredSales.forEach((s) => {
      const mk = monthKey(s.createdAt);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, expenses: 0 };
      map[mk].revenue += (Number(s.amount) || 0) * (Number(s.quantity) || 1);
    });

    filteredExpenses.forEach((e) => {
      const mk = monthKey(e.expenseDate ?? e.createdAt);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, expenses: 0 };
      map[mk].expenses += Number(e.amount) || 0;
    });

    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => {
        const [y, m] = key.split("-");
        return {
          key,
          year: y,
          monthIndex: parseInt(m, 10) - 1,
          revenue: val.revenue,
          expenses: val.expenses,
          profit: val.revenue - val.expenses,
        };
      });
  }, [paidOrders, filteredSales, filteredExpenses]);

  // ----- Chart data (chronological asc) -----
  const chartData = useMemo(
    () =>
      [...monthlyData].reverse().map((r) => ({
        label: `${t.months[r.monthIndex].slice(0, 3)} ${String(r.year).slice(2)}`,
        revenue: r.revenue,
        expenses: r.expenses,
      })),
    [monthlyData, t],
  );

  // ----- Profit per market ranking (Kern-Kennzahl) -----
  const marketRanking = useMemo(() => {
    const revById: Record<string, number> = {};
    (marketSales ?? []).forEach((s) => {
      revById[s.marketId] = (revById[s.marketId] || 0) + (Number(s.amount) || 0) * (Number(s.quantity) || 1);
    });
    return (markets ?? [])
      .filter((m) => matchesYear(m.date))
      .map((m) => {
        const revenue = revById[m.id] || 0;
        const costs = (Number(m.standFee) || 0) + (Number(m.travelCost) || 0);
        return { id: m.id, name: m.name || "—", revenue, costs, profit: revenue - costs };
      })
      .sort((a, b) => b.profit - a.profit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markets, marketSales, selectedYear]);
  const maxMarketProfit = Math.max(1, ...marketRanking.map((m) => Math.abs(m.profit)));

  // ----- Loading state -----
  if (isLoading) return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <CardSkeleton /><CardSkeleton /><CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );

  // ----- GuV Export -----
  const handleExportGuV = () => {
    const reportYear = selectedYear ?? new Date().getFullYear();
    const pName = escapeHtml(profile?.name || "Vendora");
    const pAddress = escapeHtml(profile?.address || "");
    const pEmail = escapeHtml(profile?.email || "");
    const pTaxNote = escapeHtml(profile?.taxNote || "");
    const pSmallBiz = escapeHtml(profile?.smallBusinessNote || "");
    const isDE = language === "de";

    const expensesByCategory: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const cat = isEuerCategory(e.category) ? e.category : "sonstiges";
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + (Number(e.amount) || 0);
    });

    const categoryRows = Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amount]) => `<tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;color:#4b5563;">${escapeHtml(euerLabel(cat, language))}</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;color:#1f2937;text-align:right;">${formatCurrency(amount)}</td></tr>`)
      .join("");

    const monthRows = monthlyData
      .map((row) => `<tr><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;color:#4b5563;">${isDE ? ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"][row.monthIndex] : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][row.monthIndex]} ${row.year}</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;color:#047857;text-align:right;">${formatCurrency(row.revenue)}</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;color:#dc2626;text-align:right;">${formatCurrency(row.expenses)}</td><td style="padding:8px 16px;border-bottom:1px solid #e5e7eb;font-weight:600;text-align:right;color:${row.profit >= 0 ? "#047857" : "#dc2626"}">${formatCurrency(row.profit)}</td></tr>`)
      .join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"/><title>${isDE ? "GuV" : "P&L"} ${reportYear} — ${pName}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',system-ui,sans-serif;background:#fff;color:#1f2937;padding:0}.page{max-width:800px;margin:0 auto;padding:48px}.header{border-bottom:3px solid #00B4A6;padding-bottom:24px;margin-bottom:32px;display:flex;justify-content:space-between}.brand-name{font-size:22px;font-weight:700;color:#00B4A6}.brand-details{font-size:12px;color:#6b7280;line-height:1.6;margin-top:4px}.report-title{font-size:28px;font-weight:700;text-align:right}.report-period{font-size:14px;color:#6b7280;text-align:right;margin-top:4px}h2{font-size:16px;font-weight:600;color:#1f2937;margin:32px 0 12px;text-transform:uppercase;letter-spacing:0.05em}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{padding:8px 16px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e5e7eb;background:#f9fafb}th.right{text-align:right}.summary{margin-top:32px;padding:24px;border-radius:12px}.summary-row{display:flex;justify-content:space-between;padding:8px 0;font-size:15px}.summary-row.total{border-top:2px solid #1f2937;padding-top:16px;margin-top:8px;font-size:18px;font-weight:700}.tax-notice{margin-top:24px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;text-align:center}.footer{margin-top:32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px}@media print{body{padding:0}.page{padding:24px 32px}}</style></head><body><div class="page">
<div class="header"><div><div class="brand-name">${pName}</div><div class="brand-details">${pAddress ? pAddress.replace(/\n/g, "<br/>") + "<br/>" : ""}${pEmail}</div></div><div><div class="report-title">${isDE ? "Gewinn- und Verlustrechnung" : "Profit & Loss Statement"}</div><div class="report-period">${isDE ? "Geschäftsjahr" : "Fiscal Year"} ${reportYear}</div></div></div>

<h2>${isDE ? "Zusammenfassung" : "Summary"}</h2>
<div class="summary" style="background:#f9fafb;border:1px solid #e5e7eb;">
<div class="summary-row"><span>${isDE ? "Umsatz (Aufträge)" : "Revenue (Orders)"}</span><span style="color:#047857">${formatCurrency(paidOrders.reduce((s: number, o: Order) => s + (Number(o.total) || 0), 0))}</span></div>
<div class="summary-row"><span>${isDE ? "Umsatz (Marktverkäufe)" : "Revenue (Market Sales)"}</span><span style="color:#047857">${formatCurrency(filteredSales.reduce((s: number, sa: MarketSale) => s + (Number(sa.amount) || 0) * (Number(sa.quantity) || 1), 0))}</span></div>
<div class="summary-row" style="border-top:1px solid #e5e7eb;padding-top:8px;font-weight:600"><span>${isDE ? "Gesamtumsatz" : "Total Revenue"}</span><span style="color:#047857">${formatCurrency(totalRevenue)}</span></div>
<div class="summary-row" style="margin-top:12px"><span>${isDE ? "Gesamtausgaben" : "Total Expenses"}</span><span style="color:#dc2626">${formatCurrency(totalExpenses)}</span></div>
<div class="summary-row total"><span>${isDE ? "Nettogewinn" : "Net Profit"}</span><span style="color:${netProfit >= 0 ? "#047857" : "#dc2626"}">${formatCurrency(netProfit)}</span></div>
</div>

${Object.keys(expensesByCategory).length > 0 ? `<h2>${isDE ? "Ausgaben nach Kategorie" : "Expenses by Category"}</h2>
<table><thead><tr><th>${isDE ? "Kategorie" : "Category"}</th><th class="right">${isDE ? "Betrag" : "Amount"}</th></tr></thead><tbody>${categoryRows}</tbody></table>` : ""}

${monthlyData.length > 0 ? `<h2>${isDE ? "Monatliche Entwicklung" : "Monthly Breakdown"}</h2>
<table><thead><tr><th>${isDE ? "Monat" : "Month"}</th><th class="right">${isDE ? "Umsatz" : "Revenue"}</th><th class="right">${isDE ? "Ausgaben" : "Expenses"}</th><th class="right">${isDE ? "Gewinn" : "Profit"}</th></tr></thead><tbody>${monthRows}</tbody></table>` : ""}

${pTaxNote || pSmallBiz ? `<div class="tax-notice">${pTaxNote}${pTaxNote && pSmallBiz ? "<br/>" : ""}${pSmallBiz}</div>` : ""}
<div class="footer"><p>${pName}${pEmail ? " · " + pEmail : ""}</p><p style="margin-top:4px">${isDE ? "Erstellt am" : "Generated on"} ${new Date().toLocaleDateString(isDE ? "de-DE" : "en-US")}</p></div>
</div></body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.onload = () => w.print(); }
  };

  // ----- Render -----
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{t.dashboard.overview}</h1>
        <button
          onClick={handleExportGuV}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-elevated transition-colors"
        >
          <FileDown className="h-4 w-4" />
          {language === "de" ? "GuV exportieren" : "Export P&L"}
        </button>
      </div>

      {/* Onboarding — only if no data at all */}
      {!orders?.length && !markets?.length && !expenses?.length && (
        <Card>
          <div className="text-center py-4">
            <h2 className="text-lg font-semibold text-primary mb-2">
              {language === "de" ? "Willkommen bei Vendora!" : "Welcome to Vendora!"}
            </h2>
            <p className="text-sm text-muted mb-4 max-w-md mx-auto">
              {language === "de"
                ? "Starte jetzt: Erstelle deinen ersten Auftrag, lege einen Markt an oder erfasse eine Ausgabe."
                : "Get started: Create your first order, set up a market, or track an expense."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/orders/new" className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors">
                {t.orders.newOrder}
              </Link>
              <Link href="/markets/new" className="inline-flex items-center gap-2 rounded-lg border border-brand-primary text-brand-primary px-4 py-2.5 text-sm font-medium hover:bg-brand-primary/5 transition-colors">
                {t.markets.newMarket}
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Year filter */}
      {availableYears.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedYear(null)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedYear === null
                ? "bg-brand-primary text-white"
                : "bg-elevated text-faint hover:bg-hover hover:text-secondary"
            }`}
          >
            {t.dashboard.allYears}
          </button>
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedYear === year
                  ? "bg-brand-primary text-white"
                  : "bg-elevated text-faint hover:bg-hover hover:text-secondary"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Revenue */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.revenue}</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {formatCurrency(totalRevenue)}
          </p>
        </Card>

        {/* Expenses */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.expenses}</p>
          <p className="mt-1 text-2xl font-bold text-brand-primary">
            {formatCurrency(totalExpenses)}
          </p>
        </Card>

        {/* Net Profit */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.netProfit}</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              netProfit >= 0 ? "text-green-600" : "text-brand-primary"
            }`}
          >
            {formatCurrency(netProfit)}
          </p>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{openOrdersCount}</p>
          <p className="mt-0.5 text-xs text-muted">{t.dashboard.openOrders}</p>
        </Card>

        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{paidOrdersCount}</p>
          <p className="mt-0.5 text-xs text-muted">{t.dashboard.paidOrders}</p>
        </Card>

        <Card className="text-center">
          <p className="text-2xl font-bold text-primary">{marketsCount}</p>
          <p className="mt-0.5 text-xs text-muted">{t.dashboard.markets}</p>
        </Card>
      </div>

      {/* Monthly Performance */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-primary">
          {t.dashboard.monthlyPerformance}
        </h2>

        {chartData.length > 0 && (
          <div className="mb-6 text-muted">
            <MonthlyChart
              data={chartData}
              revenueLabel={t.dashboard.revenue}
              expensesLabel={t.dashboard.expenses}
            />
          </div>
        )}

        {monthlyData.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">--</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="pb-2 pr-4 font-medium">{t.dashboard.month}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t.dashboard.revenue}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t.dashboard.expenses}</th>
                  <th className="pb-2 text-right font-medium">{t.dashboard.netProfit}</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-line-subtle last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-secondary">
                      {t.months[row.monthIndex]} {row.year}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-green-600">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-brand-primary">
                      {formatCurrency(row.expenses)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-medium ${
                        row.profit >= 0 ? "text-green-600" : "text-brand-primary"
                      }`}
                    >
                      {formatCurrency(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Profit per market (Kern-Kennzahl der Zielgruppe) */}
      {marketRanking.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-primary">
            {language === "de" ? "Gewinn je Markt" : "Profit per market"}
          </h2>
          <div className="space-y-3">
            {marketRanking.map((m) => (
              <div key={m.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate pr-2 text-secondary">{m.name}</span>
                  <span
                    className={`shrink-0 font-medium ${m.profit >= 0 ? "text-green-600" : "text-red-500"}`}
                  >
                    {formatCurrency(m.profit)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-elevated">
                  <div
                    className={`h-full rounded-full ${m.profit >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.round((Math.abs(m.profit) / maxMarketProfit) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
