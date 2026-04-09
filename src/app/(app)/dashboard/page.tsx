"use client";

import { useMemo, useState } from "react";
import { useOrders } from "@/lib/hooks/useOrders";
import { useExpenses } from "@/lib/hooks/useExpenses";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useAllMarketSales } from "@/lib/hooks/useMarketSales";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";

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
  const { t } = useLanguage();
  const { data: orders, isLoading: loadingOrders } = useOrders();
  const { data: expenses, isLoading: loadingExpenses } = useExpenses();
  const { data: markets, isLoading: loadingMarkets } = useMarkets();
  const { data: marketSales, isLoading: loadingSales } = useAllMarketSales();

  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const isLoading = loadingOrders || loadingExpenses || loadingMarkets || loadingSales;

  // ----- Collect available years -----
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    (orders ?? []).forEach((o: any) => {
      const y = yearOf(o.orderDate ?? o.createdAt);
      if (y) yearSet.add(y);
    });
    (expenses ?? []).forEach((e: any) => {
      const y = yearOf(e.expenseDate ?? e.date ?? e.createdAt);
      if (y) yearSet.add(y);
    });
    (marketSales ?? []).forEach((s: any) => {
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
        (o: any) => o.status === "paid" && matchesYear(o.orderDate ?? o.createdAt),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, selectedYear],
  );

  // ----- Market sales (filtered) -----
  const filteredSales = useMemo(
    () => (marketSales ?? []).filter((s: any) => matchesYear(s.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marketSales, selectedYear],
  );

  // ----- Expenses (filtered) -----
  const filteredExpenses = useMemo(
    () =>
      (expenses ?? []).filter((e: any) =>
        matchesYear(e.expenseDate ?? e.date ?? e.createdAt),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, selectedYear],
  );

  // ----- KPIs -----
  const totalRevenue = useMemo(() => {
    const orderRev = paidOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
    const salesRev = filteredSales.reduce(
      (sum: number, s: any) => sum + (Number(s.amount) || 0) * (Number(s.quantity) || 1),
      0,
    );
    return orderRev + salesRev;
  }, [paidOrders, filteredSales]);

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0),
    [filteredExpenses],
  );

  const netProfit = totalRevenue - totalExpenses;

  // ----- Quick stats (always unfiltered) -----
  const openOrdersCount = (orders ?? []).filter((o: any) => o.status === "open").length;
  const paidOrdersCount = (orders ?? []).filter((o: any) => o.status === "paid").length;
  const marketsCount = (markets ?? []).length;

  // ----- Monthly performance data -----
  const monthlyData = useMemo(() => {
    const map: Record<string, { revenue: number; expenses: number }> = {};

    paidOrders.forEach((o: any) => {
      const mk = monthKey(o.orderDate ?? o.createdAt);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, expenses: 0 };
      map[mk].revenue += Number(o.total) || 0;
    });

    filteredSales.forEach((s: any) => {
      const mk = monthKey(s.createdAt);
      if (!mk) return;
      if (!map[mk]) map[mk] = { revenue: 0, expenses: 0 };
      map[mk].revenue += (Number(s.amount) || 0) * (Number(s.quantity) || 1);
    });

    filteredExpenses.forEach((e: any) => {
      const mk = monthKey(e.expenseDate ?? e.date ?? e.createdAt);
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

  // ----- Loading state -----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-hover border-t-emerald-500" />
          <span className="text-sm text-muted">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  // ----- Render -----
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-primary">{t.dashboard.overview}</h1>

      {/* Year filter */}
      {availableYears.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedYear(null)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedYear === null
                ? "bg-emerald-500 text-white"
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
                  ? "bg-emerald-500 text-white"
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
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {formatCurrency(totalRevenue)}
          </p>
        </Card>

        {/* Expenses */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.expenses}</p>
          <p className="mt-1 text-2xl font-bold text-red-400">
            {formatCurrency(totalExpenses)}
          </p>
        </Card>

        {/* Net Profit */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.netProfit}</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              netProfit >= 0 ? "text-emerald-400" : "text-red-400"
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
                    <td className="py-2.5 pr-4 text-right text-emerald-400">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-red-400">
                      {formatCurrency(row.expenses)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-medium ${
                        row.profit >= 0 ? "text-emerald-400" : "text-red-400"
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
    </div>
  );
}
