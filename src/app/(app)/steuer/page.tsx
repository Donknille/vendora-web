"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, FileText } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useProfile } from "@/lib/hooks/useProfile";
import { formatCurrency, formatDate } from "@/lib/formatCurrency";
import { computeEuerReport, orderIncomeDate } from "@/lib/euerReport";
import { euerLabel } from "@/lib/euer";
import { isPaidLike } from "@/lib/orderStatus";
import { Card } from "@/components/ui/Card";
import { Skeleton, CardSkeleton } from "@/components/ui/Skeleton";
import type { Order, Expense, MarketEvent, MarketSale } from "@/lib/types";

export const dynamic = "force-dynamic";

function yearOf(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr.length < 4) return null;
  const y = Number(dateStr.slice(0, 4));
  return Number.isInteger(y) ? y : null;
}

export default function SteuerPage() {
  const { language } = useLanguage();
  const isDE = language === "de";
  const userId = useCurrentUserId();
  const { data: profile } = useProfile();
  const { data, isLoading } = useQuery<{
    orders: Order[];
    expenses: Expense[];
    markets: MarketEvent[];
    marketSales: MarketSale[];
  }>({ queryKey: [userId, "/api/dashboard"], enabled: !!userId });

  const [year, setYear] = useState<number>(() => new Date().getFullYear());

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    const marketById = new Map((data?.markets ?? []).map((m) => [m.id, m]));
    (data?.orders ?? []).forEach((o) => {
      if (isPaidLike(o.status)) {
        const y = yearOf(orderIncomeDate(o));
        if (y) years.add(y);
      }
    });
    (data?.marketSales ?? []).forEach((s) => {
      const y = yearOf(marketById.get(s.marketId)?.date ?? s.createdAt);
      if (y) years.add(y);
    });
    (data?.expenses ?? []).forEach((e) => {
      const y = yearOf(e.expenseDate);
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [data]);

  const report = useMemo(
    () =>
      computeEuerReport({
        year,
        orders: data?.orders ?? [],
        markets: data?.markets ?? [],
        marketSales: data?.marketSales ?? [],
        expenses: data?.expenses ?? [],
      }),
    [data, year],
  );

  const incomeOrders = report.lines
    .filter((l) => l.kind === "income_order")
    .reduce((s, l) => s + l.amount, 0);
  const incomeMarket = report.incomeTotal - incomeOrders;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {isDE ? "Steuer / EÜR" : "Tax / P&L"}
          </h1>
          <p className="text-sm text-muted">
            {isDE
              ? "Einnahmen-Überschuss-Rechnung nach Zuflussprinzip"
              : "Cash-basis income–expense statement"}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/euer/export?format=csv&year=${year}`}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-secondary hover:bg-elevated transition-colors"
          >
            <FileDown className="h-4 w-4" /> CSV
          </a>
          <a
            href={`/api/euer/export?format=pdf&year=${year}`}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-secondary hover:bg-elevated transition-colors"
          >
            <FileText className="h-4 w-4" /> PDF
          </a>
        </div>
      </div>

      {/* Year filter */}
      <div className="flex flex-wrap gap-2">
        {availableYears.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              year === y
                ? "bg-brand-primary text-white"
                : "bg-elevated text-faint hover:bg-hover hover:text-secondary"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-faint">{isDE ? "Einnahmen" : "Income"}</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{formatCurrency(report.incomeTotal)}</p>
        </Card>
        <Card>
          <p className="text-sm text-faint">{isDE ? "Ausgaben" : "Expenses"}</p>
          <p className="mt-1 text-2xl font-bold text-brand-primary">{formatCurrency(report.expenseTotal)}</p>
        </Card>
        <Card>
          <p className="text-sm text-faint">{isDE ? "Überschuss" : "Surplus"}</p>
          <p className={`mt-1 text-2xl font-bold ${report.surplus >= 0 ? "text-green-600" : "text-red-500"}`}>
            {formatCurrency(report.surplus)}
          </p>
        </Card>
      </div>

      {/* Income breakdown */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-primary">{isDE ? "Einnahmen" : "Income"}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-secondary">{isDE ? "Aufträge (bezahlt)" : "Orders (paid)"}</span>
            <span className="text-primary">{formatCurrency(incomeOrders)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">{isDE ? "Marktverkäufe" : "Market sales"}</span>
            <span className="text-primary">{formatCurrency(incomeMarket)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 font-medium">
            <span className="text-secondary">{isDE ? "Summe" : "Total"}</span>
            <span className="text-green-600">{formatCurrency(report.incomeTotal)}</span>
          </div>
        </div>
      </Card>

      {/* Expenses by category */}
      <Card>
        <h2 className="mb-3 text-lg font-semibold text-primary">
          {isDE ? "Ausgaben nach Kategorie" : "Expenses by category"}
        </h2>
        {report.expensesByCategory.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">—</p>
        ) : (
          <div className="space-y-2 text-sm">
            {report.expensesByCategory.map((row) => (
              <div key={row.category} className="flex justify-between">
                <span className="text-secondary">{euerLabel(row.category, language)}</span>
                <span className="text-primary">{formatCurrency(row.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-2 font-medium">
              <span className="text-secondary">{isDE ? "Summe" : "Total"}</span>
              <span className="text-brand-primary">{formatCurrency(report.expenseTotal)}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Receipts */}
      {report.lines.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-primary">{isDE ? "Belege" : "Receipts"}</h2>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-muted">
                  <th className="pb-2 pr-3 font-medium">{isDE ? "Datum" : "Date"}</th>
                  <th className="pb-2 pr-3 font-medium">{isDE ? "Beschreibung" : "Description"}</th>
                  <th className="pb-2 text-right font-medium">{isDE ? "Betrag" : "Amount"}</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((l, i) => (
                  <tr key={i} className="border-b border-line-subtle last:border-0">
                    <td className="py-2 pr-3 text-muted whitespace-nowrap">
                      {formatDate(l.date, isDE ? "de-DE" : "en-US")}
                    </td>
                    <td className="py-2 pr-3 text-secondary">
                      {l.description}
                      {l.category && (
                        <span className="ml-1 text-xs text-muted">· {euerLabel(l.category, language)}</span>
                      )}
                    </td>
                    <td className={`py-2 text-right ${l.kind === "expense" ? "text-brand-primary" : "text-green-600"}`}>
                      {l.kind === "expense" ? "−" : ""}{formatCurrency(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {profile?.isSmallBusiness && (
        <p className="text-center text-xs text-muted">
          {isDE
            ? "Kleinunternehmer nach § 19 UStG — keine Umsatzsteuer. Ohne Gewähr, keine Steuerberatung."
            : "Small business under §19 UStG — no VAT. Provided without warranty; not tax advice."}
        </p>
      )}
    </div>
  );
}
