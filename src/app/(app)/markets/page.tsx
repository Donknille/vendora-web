"use client";

import Link from "next/link";
import { Plus, Store, MapPin, Calendar } from "lucide-react";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useAllMarketSales } from "@/lib/hooks/useMarketSales";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionBanner } from "@/components/ui/SubscriptionBanner";

export default function MarketsPage() {
  const { t } = useLanguage();
  const { data: markets, isLoading } = useMarkets();
  const { data: allSales } = useAllMarketSales();

  // Group sales by marketId for quick lookup
  const salesByMarket: Record<string, any[]> = {};
  if (allSales) {
    for (const sale of allSales) {
      const mid = sale.marketId;
      if (!salesByMarket[mid]) salesByMarket[mid] = [];
      salesByMarket[mid].push(sale);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">{t.markets.title}</h1>
        <Link
          href="/markets/new"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t.markets.newMarket}
        </Link>
      </div>

      <SubscriptionBanner />

      {/* Markets list */}
      {!markets || markets.length === 0 ? (
        <EmptyState
          icon={<Store className="h-12 w-12" />}
          title={t.markets.noMarkets}
          subtitle={t.markets.noMarketsSub}
        />
      ) : (
        <div className="space-y-3">
          {markets
            .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))
            .map((market: any) => {
              const marketSales = salesByMarket[market.id] || [];
              const totalSales = marketSales.reduce(
                (sum: number, s: any) =>
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
                              {market.date}
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
                            profit >= 0 ? "text-emerald-400" : "text-red-400"
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
