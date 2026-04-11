"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Store, MapPin, Calendar, Search } from "lucide-react";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useAllMarketSales } from "@/lib/hooks/useMarketSales";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, formatDate } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionBanner } from "@/components/ui/SubscriptionBanner";
import { Skeleton, ListSkeleton } from "@/components/ui/Skeleton";

export default function MarketsPage() {
  const { t, language } = useLanguage();
  const { data: markets, isLoading } = useMarkets();
  const { data: allSales } = useAllMarketSales();
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
  const salesByMarket: Record<string, any[]> = {};
  if (allSales) {
    for (const sale of allSales) {
      const mid = sale.marketId;
      if (!salesByMarket[mid]) salesByMarket[mid] = [];
      salesByMarket[mid].push(sale);
    }
  }

  if (isLoading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-8 w-48" /><ListSkeleton count={4} /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{t.markets.title}</h1>
        <Link
          href="/markets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t.markets.newMarket}
        </Link>
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

      {/* Markets list */}
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
        <div className="space-y-3">
          {filteredMarkets
            .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
            .map((market) => {
              const marketSales = salesByMarket[market.id] || [];
              const totalSales = marketSales.reduce(
                (sum: number, s) =>
                  sum + Number(s.amount) * Number(s.quantity),
                0
              );
              const standFee = Number(market.standFee) || 0;
              const travelCost = Number(market.travelCost) || 0;
              const profit = totalSales - standFee - travelCost;

              return (
                <Link key={market.id} href={`/markets/${market.id}`}>
                  <Card className="hover:border-line-hover transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-primary truncate">
                          {market.name}
                        </h3>
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
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm text-faint">
                          {t.markets.sales}: {formatCurrency(totalSales)}
                        </p>
                        <p
                          className={`text-sm font-semibold ${
                            profit >= 0 ? "text-green-600" : "text-brand-primary"
                          }`}
                        >
                          {t.markets.profit}: {formatCurrency(profit)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
