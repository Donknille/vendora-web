"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  MapPin,
  Calendar,
  Copy,
  RefreshCw,
  CheckCircle2,
  Banknote,
  CreditCard,
  Store,
} from "lucide-react";
import { useMarkets, useDeleteMarket, useCopyMarket } from "@/lib/hooks/useMarkets";
import {
  useMarketSales,
  useAllMarketSales,
  useDeleteMarketSale,
} from "@/lib/hooks/useMarketSales";
import { useOfflineSales } from "@/lib/offline/useOfflineSales";
import { useCanCreate } from "@/lib/hooks/useSubscription";
import { computeDayClosing } from "@/lib/marketDay";
import { computeYearComparison } from "@/lib/marketCalendar";
import type { MarketSale } from "@/lib/types";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, formatDate, parseAmount } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TseNotice } from "@/components/markets/TseNotice";

export default function MarketDetailPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const marketId = params.id as string;

  const { data: markets, isLoading } = useMarkets();
  const { data: sales } = useMarketSales(marketId);
  const { data: allSales } = useAllMarketSales();
  const deleteMarket = useDeleteMarket();
  const deleteSale = useDeleteMarketSale();
  const copyMarket = useCopyMarket();
  const { pending, syncing, recordSale } = useOfflineSales(marketId);
  const canCreate = useCanCreate();

  const [error, setError] = useState("");

  // Add-sale form state
  const [saleDescription, setSaleDescription] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [showAddSale, setShowAddSale] = useState(false);

  // Confirm dialogs
  const [confirmDeleteMarket, setConfirmDeleteMarket] = useState(false);
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState<string | null>(null);

  const market = markets?.find((m) => m.id === marketId);

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

  // Sales the server already knows about carry a clientId; drop those from the
  // pending queue view so a freshly-synced sale isn't shown (and counted) twice.
  const serverClientIds = new Set(
    (sales ?? []).map((s) => s.clientId).filter(Boolean) as string[]
  );
  const unsyncedPending = pending.filter((p) => !serverClientIds.has(p.clientId));

  const serverTotal = (sales || []).reduce(
    (sum: number, s) => sum + Number(s.amount) * Number(s.quantity),
    0
  );
  const pendingTotal = unsyncedPending.reduce(
    (sum, p) => sum + p.amount * p.quantity,
    0
  );
  const totalSales = serverTotal + pendingTotal;

  // Day closing (Tagesabschluss): combine server + unsynced sales, split by
  // payment method.
  const closing = computeDayClosing(
    [
      ...(sales ?? []).map((s) => ({
        amount: Number(s.amount),
        quantity: Number(s.quantity),
        paymentMethod: s.paymentMethod,
      })),
      ...unsyncedPending.map((p) => ({
        amount: p.amount,
        quantity: p.quantity,
        paymentMethod: p.paymentMethod,
      })),
    ],
    standFee,
    travelCost
  );

  // Year-over-year comparison: markets that share this market's name form a
  // "series" (created via "Markt kopieren"). Compare their revenue/profit by year.
  const sameNameMarkets = (markets ?? []).filter((m) => m.name === market.name);
  const salesByMarketId: Record<string, MarketSale[]> = {};
  for (const s of allSales ?? []) {
    (salesByMarketId[s.marketId] ??= []).push(s);
  }
  const yearStats = computeYearComparison(
    sameNameMarkets.map((m) => ({
      id: m.id,
      date: m.date,
      standFee: Number(m.standFee) || 0,
      travelCost: Number(m.travelCost) || 0,
    })),
    salesByMarketId
  );

  const readOnlyMsg =
    language === "de"
      ? "Nur-Lese-Modus – für neue Verkäufe wird Vendora Pro benötigt."
      : "Read-only – Vendora Pro is required to record sales.";

  const handleQuickSale = async (item: { name: string; price: number }) => {
    setError("");
    if (!canCreate) {
      setError(readOnlyMsg);
      return;
    }
    try {
      await recordSale({ description: item.name, amount: item.price, quantity: 1 });
    } catch {
      setError("Verkauf konnte nicht gespeichert werden.");
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canCreate) {
      setError(readOnlyMsg);
      return;
    }
    if (!saleDescription.trim() || !saleAmount.trim()) return;

    try {
      await recordSale({
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
    setConfirmDeleteMarket(false);
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      await deleteSale.mutateAsync(saleId);
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
    const serverCount = (sales ?? [])
      .filter((s) => s.description === itemName && Number(s.amount) === itemPrice)
      .reduce((sum, s) => sum + Number(s.quantity), 0);
    const pendingCountForItem = unsyncedPending
      .filter((p) => p.description === itemName && p.amount === itemPrice)
      .reduce((sum, p) => sum + p.quantity, 0);
    return serverCount + pendingCountForItem;
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

      {/* Open the full-screen POS / market mode */}
      <Link
        href={`/markets/${marketId}/kasse`}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-primary/90 active:scale-[0.99] transition-all"
      >
        <Store className="h-5 w-5" />
        {language === "de" ? "Kasse öffnen" : "Open register"}
      </Link>

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
                  className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-4 hover:border-brand-primary hover:bg-brand-primary/5 active:scale-95 transition-all disabled:opacity-50"
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
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-faint uppercase tracking-wider">
              {market.quickItems && market.quickItems.length > 0 ? t.markets.otherSale : t.markets.sales}
            </h3>
            {syncing ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <RefreshCw className="h-3 w-3 animate-spin" />
                {language === "de" ? "Synchronisiere…" : "Syncing…"}
              </span>
            ) : unsyncedPending.length > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                <RefreshCw className="h-3 w-3" />
                {unsyncedPending.length} {language === "de" ? "ausstehend" : "pending"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <CheckCircle2 className="h-3 w-3 text-green-600" />
                {language === "de" ? "Synchronisiert" : "Synced"}
              </span>
            )}
          </div>
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
              <button type="submit" className="flex-1 rounded-lg bg-brand-primary py-2 text-sm font-medium text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-colors">
                {t.common.save}
              </button>
              <button type="button" onClick={() => setShowAddSale(false)} className="rounded-lg px-4 py-2 text-sm text-faint hover:text-secondary hover:bg-elevated transition-colors">
                {t.common.cancel}
              </button>
            </div>
          </form>
        )}

        {/* Sales List */}
        {(!sales || sales.length === 0) && unsyncedPending.length === 0 ? (
          <p className="text-sm text-muted">{t.markets.noSales}</p>
        ) : (
          <div className="space-y-2">
            {/* Unsynced offline sales (still in the local queue) */}
            {unsyncedPending.map((p) => (
              <div key={p.clientId} className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-secondary truncate">{p.description}</p>
                  <p className="text-xs text-muted">
                    {p.quantity > 1
                      ? `${p.quantity} × ${formatCurrency(p.amount)}`
                      : formatCurrency(p.amount)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-amber-600">
                    {formatCurrency(p.amount * p.quantity)}
                  </span>
                  <RefreshCw
                    className="h-4 w-4 text-amber-500"
                    aria-label={language === "de" ? "wird synchronisiert" : "syncing"}
                  />
                </div>
              </div>
            ))}
            {(sales ?? []).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-lg border border-line bg-page px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-secondary truncate">{sale.description}</p>
                  <p className="text-xs text-muted">
                    {Number(sale.quantity) > 1
                      ? `${sale.quantity} × ${formatCurrency(Number(sale.amount))}`
                      : formatCurrency(Number(sale.amount))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(Number(sale.amount) * Number(sale.quantity))}
                  </span>
                  <button onClick={() => setConfirmDeleteSaleId(sale.id)} className="rounded p-1 text-muted hover:text-red-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sales Total */}
        {((sales && sales.length > 0) || unsyncedPending.length > 0) && (
          <div className="mt-3 border-t border-line pt-3 flex items-center justify-between text-sm font-medium">
            <span className="text-secondary">{t.orders.total}</span>
            <span className="text-green-600">{formatCurrency(totalSales)}</span>
          </div>
        )}
      </Card>

      {/* Tagesabschluss (day closing) */}
      <Card>
        <h3 className="mb-3 text-sm font-medium text-faint uppercase tracking-wider">
          {language === "de" ? "Tagesabschluss" : "Day closing"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-line bg-page p-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-faint">
              <Banknote className="h-3.5 w-3.5" /> {language === "de" ? "Bar" : "Cash"}
            </p>
            <p className="mt-1 text-lg font-semibold text-primary tabular-nums">{formatCurrency(closing.cash)}</p>
          </div>
          <div className="rounded-lg border border-line bg-page p-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-faint">
              <CreditCard className="h-3.5 w-3.5" /> {language === "de" ? "Karte" : "Card"}
            </p>
            <p className="mt-1 text-lg font-semibold text-primary tabular-nums">{formatCurrency(closing.card)}</p>
          </div>
        </div>
        {closing.unknown > 0 && (
          <p className="mt-2 text-xs text-muted">
            {language === "de" ? "Ohne Zahlart" : "No method"}: {formatCurrency(closing.unknown)}
          </p>
        )}
        <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t.markets.sales} ({closing.count})</span>
            <span className="text-primary tabular-nums">{formatCurrency(closing.total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-secondary">{t.markets.costs}</span>
            <span className="text-primary tabular-nums">−{formatCurrency(closing.costs)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2 font-medium">
            <span className="text-secondary">{t.markets.profit}</span>
            <span className={`text-lg font-bold tabular-nums ${closing.profit >= 0 ? "text-green-600" : "text-brand-primary"}`}>
              {formatCurrency(closing.profit)}
            </span>
          </div>
        </div>
      </Card>

      {/* Year-over-year comparison across same-named markets */}
      {sameNameMarkets.length > 1 && (
        <Card>
          <h3 className="mb-3 text-sm font-medium text-faint uppercase tracking-wider">
            {language === "de" ? "Jahresvergleich" : "Year comparison"}
          </h3>
          <div className="space-y-2">
            {yearStats.map((y) => (
              <div
                key={y.marketId}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  y.marketId === marketId
                    ? "border-brand-primary/40 bg-brand-primary/5"
                    : "border-line bg-page"
                }`}
              >
                <span className="font-medium text-secondary tabular-nums">{y.year}</span>
                <div className="flex items-center gap-4">
                  <span className="text-faint">
                    {t.markets.sales}:{" "}
                    <span className="text-primary tabular-nums">{formatCurrency(y.sales)}</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${y.profit >= 0 ? "text-green-600" : "text-brand-primary"}`}>
                    {formatCurrency(y.profit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TseNotice />

      {/* Action Buttons */}
      <div className="space-y-3">
        {canCreate && (
          <button
            onClick={handleCopy}
            disabled={copyMarket.isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium text-secondary hover:bg-elevated transition-colors disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            {copyMarket.isPending ? t.common.loading : t.markets.copyMarket}
          </button>
        )}

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
        open={!!confirmDeleteSaleId}
        onClose={() => setConfirmDeleteSaleId(null)}
        onConfirm={() => { if (confirmDeleteSaleId) { handleDeleteSale(confirmDeleteSaleId); setConfirmDeleteSaleId(null); } }}
        title={t.markets.deleteSale}
        message={t.markets.removeSale}
        confirmText={t.markets.deleteAction}
        cancelText={t.markets.deleteCancel}
      />
    </div>
  );
}
