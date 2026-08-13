"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Store, MapPin, Calendar, Search, AlarmClock } from "lucide-react";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useAllMarketSales } from "@/lib/hooks/useMarketSales";
import { useCanCreate } from "@/lib/hooks/useSubscription";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, formatDate } from "@/lib/formatCurrency";
import { deadlineInfo, statusLabel, statusClasses } from "@/lib/marketCalendar";
import { shouldBookMarketCosts } from "@/lib/marketCosts";
import type { MarketEvent, MarketSale } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionBanner } from "@/components/ui/SubscriptionBanner";
import { Skeleton, ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
// Alias: die Seite fuehrt eine lokale Konstante `today`.
import { today as todayIso } from "@/lib/date";

export default function MarketsPage() {
  const { t, language } = useLanguage();
  const marketsQuery = useMarkets();
  const salesQuery = useAllMarketSales();
  const { data: markets } = marketsQuery;
  const { data: allSales } = salesQuery;
  // Sales drive the revenue and profit on every card, so waiting for both keeps
  // the cards from flashing 0,00 € and a profit that is only the costs.
  const isLoading = marketsQuery.isLoading || salesQuery.isLoading;
  const isError = marketsQuery.isError || salesQuery.isError;
  const canCreate = useCanCreate();
  const [search, setSearch] = useState("");

  const filteredMarkets = useMemo(() => {
    if (!search.trim()) return markets ?? [];
    const q = search.toLowerCase();
    return (markets ?? []).filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.location?.toLowerCase().includes(q)
    );
  }, [markets, search]);

  // Group sales by marketId for quick lookup
  const salesByMarket: Record<string, MarketSale[]> = {};
  if (allSales) {
    for (const sale of allSales) {
      const mid = sale.marketId;
      if (!salesByMarket[mid]) salesByMarket[mid] = [];
      salesByMarket[mid].push(sale);
    }
  }

  const today = todayIso();

  const renderMarketCard = (market: MarketEvent) => {
    const marketSales = salesByMarket[market.id] || [];
    const totalSales = marketSales.reduce(
      (sum: number, s) => sum + Number(s.amount) * Number(s.quantity),
      0
    );
    const standFee = Number(market.standFee) || 0;
    const travelCost = Number(market.travelCost) || 0;
    // Bewusst die *geplanten* Kosten: diese Karte ist die Planungssicht. Das
    // Dashboard-Ranking (computeMarketRanking) rechnet dagegen mit den
    // tatsaechlich gebuchten Ausgabenzeilen — der Hinweis unten macht den
    // Unterschied sichtbar, statt ihn zu verstecken.
    const profit = totalSales - standFee - travelCost;
    const dl = deadlineInfo(market.applicationDeadline, today, market.status);
    const costsUnbooked =
      standFee + travelCost > 0 && !shouldBookMarketCosts(market.status) && market.date < today;

    return (
      <Link key={market.id} href={`/markets/${market.id}`}>
        <Card className="hover:border-line-hover transition-colors cursor-pointer">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-primary truncate">{market.name}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClasses(market.status)}`}>
                  {statusLabel(market.status, language === "de")}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
                {market.date && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(market.date, language === "de" ? "de-DE" : "en-US")}
                  </span>
                )}
                {market.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {market.location}
                  </span>
                )}
              </div>
              {dl.state !== "none" && (
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
                    dl.state === "overdue"
                      ? "bg-red-500/10 text-red-500"
                      : dl.state === "soon"
                        ? "bg-amber-500/10 text-amber-600"
                        : "text-faint"
                  }`}
                >
                  <AlarmClock className="h-3 w-3" />
                  {language === "de" ? "Frist" : "Deadline"}:{" "}
                  {formatDate(market.applicationDeadline!, language === "de" ? "de-DE" : "en-US")}
                  {dl.state === "overdue"
                    ? language === "de" ? " (abgelaufen)" : " (passed)"
                    : dl.days != null && dl.days <= 7
                      ? language === "de" ? ` (in ${dl.days} T.)` : ` (in ${dl.days}d)`
                      : ""}
                </span>
              )}
              {costsUnbooked && (
                <span className="mt-1.5 flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                  <AlarmClock className="h-3 w-3" />
                  {language === "de"
                    ? `Kosten nicht in der EÜR — Status „${statusLabel(market.status, true)}“`
                    : `Costs not in the P&L — status “${statusLabel(market.status, false)}”`}
                </span>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm text-faint">
                {t.markets.sales}: {formatCurrency(totalSales)}
              </p>
              <p className={`text-sm font-semibold ${profit >= 0 ? "text-green-600" : "text-brand-primary"}`}>
                {t.markets.profit}: {formatCurrency(profit)}
              </p>
            </div>
          </div>
        </Card>
      </Link>
    );
  };

  const upcoming = filteredMarkets
    .filter((m) => (m.date || "") >= today)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const past = filteredMarkets
    .filter((m) => (m.date || "") < today)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (isLoading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-8 w-48" /><ListSkeleton count={4} /></div>;
  if (isError) return <div className="mx-auto max-w-2xl"><ErrorState onRetry={() => { marketsQuery.refetch(); salesQuery.refetch(); }} /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{t.markets.title}</h1>
        {canCreate && (
          <Link
            href="/markets/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t.markets.newMarket}
          </Link>
        )}
      </div>

      <SubscriptionBanner />

      {/* Search */}
      {markets && markets.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-line bg-input pl-10 pr-4 py-2.5 text-sm text-primary placeholder-holder focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-colors"
            placeholder={language === "de" ? "Suchen..." : "Search..."}
          />
        </div>
      )}

      {/* Markets list — grouped into upcoming and past (calendar view) */}
      {!markets || markets.length === 0 ? (
        <EmptyState
          icon={<Store className="h-12 w-12" />}
          title={t.markets.noMarkets}
          subtitle={t.markets.noMarketsSub}
        />
      ) : filteredMarkets.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted text-sm">
            {language === "de" ? "Keine Ergebnisse gefunden." : "No results found."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
                {language === "de" ? "Anstehend" : "Upcoming"}
              </h2>
              {upcoming.map(renderMarketCard)}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
                {language === "de" ? "Vergangen" : "Past"}
              </h2>
              {past.map(renderMarketCard)}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
