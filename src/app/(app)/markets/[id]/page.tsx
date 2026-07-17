"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  MapPin,
  Calendar,
  Copy,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useMarkets, useDeleteMarket, useCopyMarket } from "@/lib/hooks/useMarkets";
import { useMarketSales } from "@/lib/hooks/useMarketSales";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, formatDate, parseAmount } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { requestPersistentStorage } from "@/lib/offline/persist";
import {
  recordSale,
  removeSale,
  preloadMarket,
  subscribeQueue,
} from "@/lib/offline/queue";
import {
  useMarketQueueOps,
  mergeMarketSales,
  type DisplaySale,
} from "@/lib/offline/useOfflineQueue";
import { useWakeLock } from "@/lib/offline/useWakeLock";

export default function MarketDetailPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const marketId = params.id as string;
  const queryClient = useQueryClient();

  const { data: markets, isLoading } = useMarkets();
  const { data: sales } = useMarketSales(marketId);
  const deleteMarket = useDeleteMarket();
  const copyMarket = useCopyMarket();
  const queueOps = useMarketQueueOps(marketId);

  const [error, setError] = useState("");

  const market = markets?.find((m) => m.id === marketId);

  // Keep the screen awake while the market mode is open (Phase 5.3).
  useWakeLock(!!market);

  // Market-mode start (Phase 3.5): best-effort request for persistent storage.
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  // Preload market + quickItems into IndexedDB so the sell screen can start
  // offline (Phase 4.6).
  useEffect(() => {
    if (!market) return;
    void preloadMarket({
      id: market.id,
      name: market.name,
      date: market.date,
      location: market.location,
      quickItems: market.quickItems ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on market id; other fields are snapshotted at preload time
  }, [market?.id]);

  // Refetch server sales whenever the queue changes, so a synced sale replaces
  // its optimistic local counterpart (deduped by clientId).
  useEffect(() => {
    return subscribeQueue(() => {
      queryClient.invalidateQueries({
        queryKey: ["/api/markets", marketId, "sales"],
      });
    });
  }, [queryClient, marketId]);

  // Add-sale form state
  const [saleDescription, setSaleDescription] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [showAddSale, setShowAddSale] = useState(false);

  // Confirm dialogs
  const [confirmDeleteMarket, setConfirmDeleteMarket] = useState(false);
  const [confirmDeleteSale, setConfirmDeleteSale] = useState<DisplaySale | null>(null);

  const displayedSales = useMemo(
    () => mergeMarketSales(sales ?? [], queueOps),
    [sales, queueOps]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.common.loading}</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">{t.markets.noMarkets}</p>
      </div>
    );
  }

  const standFee = Number(market.standFee) || 0;
  const travelCost = Number(market.travelCost) || 0;
  const totalSales = displayedSales.reduce(
    (sum, s) => sum + s.amount * s.quantity,
    0
  );
  const profit = totalSales - standFee - travelCost;

  // Optimistic (Phase 5.4): the sale is confirmed from the local queue at once.
  const handleQuickSale = async (item: { name: string; price: number }) => {
    setError("");
    try {
      await recordSale({ marketId, description: item.name, amount: item.price, quantity: 1 });
    } catch {
      setError("Verkauf konnte nicht gespeichert werden.");
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!saleDescription.trim() || !saleAmount.trim()) return;

    try {
      await recordSale({
        marketId,
        description: saleDescription.trim(),
        amount: parseAmount(saleAmount),
        quantity: parseInt(saleQuantity, 10) || 1,
      });
      setSaleDescription("");
      setSaleAmount("");
      setSaleQuantity("1");
      setShowAddSale(false);
    } catch {
      setError("Verkauf konnte nicht gespeichert werden.");
    }
  };

  const handleDeleteMarket = async () => {
    try {
      await deleteMarket.mutateAsync(marketId);
      router.push("/markets");
    } catch {
      setError("Markt konnte nicht gelöscht werden.");
    }
  };

  const handleDeleteSale = async (sale: DisplaySale) => {
    try {
      await removeSale({ clientId: sale.clientId, marketId, serverId: sale.serverId });
    } catch {
      setError("Verkauf konnte nicht gelöscht werden.");
    }
  };

  const handleCopy = async () => {
    setError("");
    try {
      const copied = await copyMarket.mutateAsync(marketId);
      router.push(`/markets/${copied.id}/edit`);
    } catch {
      setError("Markt konnte nicht kopiert werden.");
    }
  };

  const getSoldCount = (itemName: string, itemPrice: number) => {
    return displayedSales
      .filter((s) => s.description === itemName && s.amount === itemPrice)
      .reduce((sum, s) => sum + s.quantity, 0);
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/markets"
            className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-primary">
            {t.markets.marketDetails}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/markets/${marketId}/edit`}
            className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-secondary transition-colors"
          >
            <Pencil className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setConfirmDeleteMarket(true)}
            className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Market Info */}
      <Card>
        <h2 className="text-lg font-semibold text-primary">{market.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
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
        {market.notes && (
          <p className="mt-3 text-sm text-faint">{market.notes}</p>
        )}
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <h3 className="text-sm font-medium text-faint uppercase tracking-wider mb-3">
          {t.markets.costBreakdown}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">{t.markets.standFee}</span>
            <span className="text-primary">{formatCurrency(standFee)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-secondary">{t.markets.travel}</span>
            <span className="text-primary">{formatCurrency(travelCost)}</span>
          </div>
          <div className="border-t border-line pt-2 flex items-center justify-between text-sm font-medium">
            <span className="text-secondary">{t.markets.costs}</span>
            <span className="text-primary">{formatCurrency(standFee + travelCost)}</span>
          </div>
        </div>
      </Card>

      {/* Quick Sale Buttons */}
      {market.quickItems && market.quickItems.length > 0 && (
        <Card>
          <h3 className="text-sm font-medium text-faint uppercase tracking-wider mb-3">
            {t.markets.quickSale}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {market.quickItems.map((item, idx) => {
              const soldCount = getSoldCount(item.name, item.price);
              return (
                <button
                  key={idx}
                  onClick={() => handleQuickSale(item)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-4 hover:border-brand-primary hover:bg-brand-primary/5 active:scale-95 transition-all"
                >
                  <span className="text-sm font-semibold text-primary truncate w-full text-center">
                    {item.name}
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {formatCurrency(item.price)}
                  </span>
                  {soldCount > 0 && (
                    <span className="text-xs text-muted">
                      {soldCount}× {t.markets.sold}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Sales Section */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-faint uppercase tracking-wider">
            {market.quickItems && market.quickItems.length > 0 ? t.markets.otherSale : t.markets.sales}
          </h3>
          <button
            onClick={() => setShowAddSale(!showAddSale)}
            className="rounded-lg p-1.5 text-brand-primary hover:bg-elevated transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Add Sale Form */}
        {showAddSale && (
          <form onSubmit={handleAddSale} className="mb-4 space-y-3 rounded-lg border border-line bg-page p-3">
            <input type="text" value={saleDescription} onChange={(e) => setSaleDescription(e.target.value)} className={inputClass} placeholder={t.markets.itemDescription} required />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" inputMode="decimal" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} className={inputClass} placeholder={t.expenses.amount} required />
              <input type="number" min="1" value={saleQuantity} onChange={(e) => setSaleQuantity(e.target.value)} className={inputClass} placeholder={t.orders.qty} />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="flex-1 rounded-lg bg-brand-primary py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors">
                {t.common.save}
              </button>
              <button type="button" onClick={() => setShowAddSale(false)} className="rounded-lg px-4 py-2 text-sm text-faint hover:text-secondary hover:bg-elevated transition-colors">
                {t.common.cancel}
              </button>
            </div>
          </form>
        )}

        {/* Sales List */}
        {displayedSales.length === 0 ? (
          <p className="text-sm text-muted">{t.markets.noSales}</p>
        ) : (
          <div className="space-y-2">
            {displayedSales.map((sale) => (
              <div key={sale.clientId} className="flex items-center justify-between rounded-lg border border-line bg-page px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-secondary truncate">
                    <span className="truncate">{sale.description}</span>
                    {(sale.status === "pending" || sale.status === "syncing") && (
                      <Clock className="h-3 w-3 shrink-0 text-muted" aria-label="Wird synchronisiert" />
                    )}
                    {sale.status === "failed" && (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-label="Synchronisierung fehlgeschlagen" />
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {sale.quantity > 1
                      ? `${sale.quantity} × ${formatCurrency(sale.amount)}`
                      : formatCurrency(sale.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(sale.amount * sale.quantity)}
                  </span>
                  <button onClick={() => setConfirmDeleteSale(sale)} className="rounded p-1 text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sales Total */}
        {displayedSales.length > 0 && (
          <div className="mt-3 border-t border-line pt-3 flex items-center justify-between text-sm font-medium">
            <span className="text-secondary">{t.orders.total}</span>
            <span className="text-green-600">{formatCurrency(totalSales)}</span>
          </div>
        )}
      </Card>

      {/* Profit */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-faint uppercase tracking-wider">{t.markets.profit}</h3>
          <span className={`text-xl font-bold ${profit >= 0 ? "text-green-600" : "text-brand-primary"}`}>
            {formatCurrency(profit)}
          </span>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleCopy}
          disabled={copyMarket.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-secondary hover:bg-elevated transition-colors disabled:opacity-50"
        >
          <Copy className="h-4 w-4" />
          {copyMarket.isPending ? t.common.loading : t.markets.copyMarket}
        </button>

        <button
          onClick={() => setConfirmDeleteMarket(true)}
          className="w-full rounded-lg border border-red-500/20 bg-red-500/5 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          {t.markets.deleteMarket}
        </button>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={confirmDeleteMarket}
        onClose={() => setConfirmDeleteMarket(false)}
        onConfirm={handleDeleteMarket}
        title={t.markets.deleteMarket}
        message={t.markets.deleteMarketConfirm}
        confirmText={t.markets.deleteAction}
        cancelText={t.markets.deleteCancel}
      />
      <ConfirmDialog
        open={!!confirmDeleteSale}
        onClose={() => setConfirmDeleteSale(null)}
        onConfirm={() => { if (confirmDeleteSale) handleDeleteSale(confirmDeleteSale); }}
        title={t.markets.deleteSale}
        message={t.markets.removeSale}
        confirmText={t.markets.deleteAction}
        cancelText={t.markets.deleteCancel}
      />
    </div>
  );
}
