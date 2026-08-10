"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FileText, HelpCircle } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { isPaidLike } from "@/lib/orderStatus";
import {
  aggregateEuerReports,
  computeEuerReports,
  euerAvailableYears,
  type EuerData,
} from "@/lib/euerReport";
import { computeMarketRanking } from "@/lib/marketRanking";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import { Card } from "@/components/ui/Card";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { InstallHint } from "@/components/pwa/InstallHint";
import type { Order, Expense, MarketEvent, MarketSale } from "@/lib/types";

// Charts are client-only (recharts needs the DOM); avoids SSR/hydration churn.
const MonthlyChart = dynamic(
  () => import("@/components/MonthlyChart").then((m) => m.MonthlyChart),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const userId = useCurrentUserId();
  // Single batched API call instead of 4 separate ones
  const { data, isLoading, isError, refetch } = useAppQuery<{
    orders: Order[];
    expenses: Expense[];
    markets: MarketEvent[];
    marketSales: MarketSale[];
  }>([userId, "/api/dashboard"]);

  const orders = data?.orders;
  const expenses = data?.expenses;
  const markets = data?.markets;
  const marketSales = data?.marketSales;

  // null = alle Jahre. Default ist das laufende Jahr — dasselbe wie auf
  // /steuer, sonst koennen die Ausgaben-Kacheln beider Seiten gar nicht
  // uebereinstimmen.
  const [selectedYear, setSelectedYear] = useState<number | null>(() => new Date().getFullYear());

  // Beide Seiten rechnen mit computeEuerReport — hier gibt es keine zweite
  // Buchungslogik mehr (kein eigenes Datumsparsing, kein eigenes
  // Status-Praedikat, keine eigene Datierung der Marktverkaeufe).
  const euerData: EuerData = useMemo(
    () => ({
      orders: orders ?? [],
      markets: markets ?? [],
      marketSales: marketSales ?? [],
      expenses: expenses ?? [],
    }),
    [orders, markets, marketSales, expenses],
  );

  const availableYears = useMemo(
    () => euerAvailableYears(euerData, { includeYear: new Date().getFullYear() }),
    [euerData],
  );

  // "Alle Jahre" = Summe der Jahresberichte, nicht eine zweite Rechnung.
  const report = useMemo(
    () =>
      aggregateEuerReports(
        computeEuerReports(euerData, selectedYear === null ? availableYears : [selectedYear]),
      ),
    [euerData, selectedYear, availableYears],
  );

  // ----- Quick stats (always unfiltered) -----
  // Bestandsgroessen ("wie viele offene Auftraege habe ich"), keine
  // Periodengroessen — deshalb bewusst ohne Jahresfilter.
  const openOrdersCount = (orders ?? []).filter((o) => o.status === "open").length;
  const paidOrdersCount = (orders ?? []).filter((o) => isPaidLike(o.status)).length;
  const marketsCount = (markets ?? []).length;

  // ----- Monthly performance (report.months ist asc, die Tabelle zeigt desc) -----
  const monthlyData = useMemo(() => [...report.months].reverse(), [report]);

  const chartData = useMemo(
    () =>
      report.months.map((r) => ({
        label: `${t.months[r.monthIndex].slice(0, 3)} ${String(r.year).slice(2)}`,
        revenue: r.income,
        expenses: r.expenses,
      })),
    [report, t],
  );

  // ----- Profit per market ranking (Kern-Kennzahl) -----
  const marketRanking = useMemo(
    () =>
      computeMarketRanking({
        markets: euerData.markets,
        marketSales: euerData.marketSales,
        expenses: euerData.expenses,
        years: selectedYear === null ? null : [selectedYear],
      }),
    [euerData, selectedYear],
  );
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

  if (isError) return <div className="mx-auto max-w-5xl"><ErrorState onRetry={() => refetch()} /></div>;

  // ----- Render -----
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{t.dashboard.overview}</h1>
        <div className="flex items-center gap-2">
          {/* Der GuV-Export lebt auf /steuer: dort wird er serverseitig aus dem
              EUeR-Report erzeugt (CSV/PDF) statt im Client nachgebaut. */}
          <Link
            href="/steuer"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-elevated transition-colors"
          >
            <FileText className="h-4 w-4" />
            {language === "de" ? "GuV / EÜR" : "P&L / Tax"}
          </Link>
          {/* Der Zugang zur Hilfe auf dem Handy — in der unteren Leiste ist
              kein Platz mehr. */}
          <Link
            href="/hilfe"
            aria-label={t.help.title}
            title={t.help.title}
            className="inline-flex items-center justify-center rounded-lg border border-line bg-surface p-2 text-secondary hover:bg-elevated transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Die Willkommens-Erklärung entscheidet selbst, ob sie erscheint — genau
          einmal je Konto, siehe lib/onboarding.ts. */}
      <WelcomeTour />

      {/* Der Installationshinweis erscheint erst, wenn tatsächlich etwas
          angelegt wurde; davor steht hier die Willkommenskarte. */}
      <InstallHint hasData={!!orders?.length || !!markets?.length} />

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
            {formatCurrency(report.incomeTotal)}
          </p>
        </Card>

        {/* Expenses */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.expenses}</p>
          <p className="mt-1 text-2xl font-bold text-brand-primary">
            {formatCurrency(report.expenseTotal)}
          </p>
        </Card>

        {/* Net Profit */}
        <Card>
          <p className="text-sm text-faint">{t.dashboard.netProfit}</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              report.surplus >= 0 ? "text-green-600" : "text-brand-primary"
            }`}
          >
            {formatCurrency(report.surplus)}
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
                      {formatCurrency(row.income)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-brand-primary">
                      {formatCurrency(row.expenses)}
                    </td>
                    <td
                      className={`py-2.5 text-right font-medium ${
                        row.surplus >= 0 ? "text-green-600" : "text-brand-primary"
                      }`}
                    >
                      {formatCurrency(row.surplus)}
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
                  <span className="truncate pr-2 text-secondary">
                    {m.name}
                    {/* Die Kosten stammen aus den gebuchten Ausgabenzeilen. Ein
                        Markt, der wegen seines Status nichts bucht, erscheint
                        sonst grundlos profitabel. */}
                    {!m.costsBooked && (
                      <span className="ml-2 text-xs text-amber-600">
                        {language === "de" ? "Kosten nicht gebucht" : "costs not booked"}
                      </span>
                    )}
                  </span>
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
