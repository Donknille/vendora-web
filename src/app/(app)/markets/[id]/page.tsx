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
} from "lucide-react";
import { useMarkets, useDeleteMarket } from "@/lib/hooks/useMarkets";
import {
  useMarketSales,
  useCreateMarketSale,
  useDeleteMarketSale,
} from "@/lib/hooks/useMarketSales";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function MarketDetailPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const marketId = params.id as string;

  const { data: markets, isLoading } = useMarkets();
  const { data: sales } = useMarketSales(marketId);
  const deleteMarket = useDeleteMarket();
  const createSale = useCreateMarketSale();
  const deleteSale = useDeleteMarketSale();

  // Add-sale form state
  const [saleDescription, setSaleDescription] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [showAddSale, setShowAddSale] = useState(false);

  // Confirm dialogs
  const [confirmDeleteMarket, setConfirmDeleteMarket] = useState(false);
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState<string | null>(
    null
  );

  const market = markets?.find((m: any) => m.id === marketId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">Market not found</p>
      </div>
    );
  }

  const standFee = Number(market.standFee) || 0;
  const travelCost = Number(market.travelCost) || 0;
  const totalSales = (sales || []).reduce(
    (sum: number, s: any) => sum + Number(s.amount) * Number(s.quantity),
    0
  );
  const profit = totalSales - standFee - travelCost;

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleDescription.trim() || !saleAmount.trim()) return;

    await createSale.mutateAsync({
      marketId,
      description: saleDescription.trim(),
      amount: parseAmount(saleAmount),
      quantity: parseInt(saleQuantity, 10) || 1,
    });

    setSaleDescription("");
    setSaleAmount("");
    setSaleQuantity("1");
    setShowAddSale(false);
  };

  const handleDeleteMarket = async () => {
    await deleteMarket.mutateAsync(marketId);
    router.push("/markets");
  };

  const handleDeleteSale = async (saleId: string) => {
    await deleteSale.mutateAsync(saleId);
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/markets"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100">
            {t.markets.marketDetails}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/markets/${marketId}/edit`}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <Pencil className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setConfirmDeleteMarket(true)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Market Info */}
      <Card>
        <h2 className="text-lg font-semibold text-zinc-100">{market.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
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
        {market.notes && (
          <p className="mt-3 text-sm text-zinc-400">{market.notes}</p>
        )}
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
          {t.markets.costBreakdown}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">{t.markets.standFee}</span>
            <span className="text-zinc-100">{formatCurrency(standFee)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">{t.markets.travel}</span>
            <span className="text-zinc-100">{formatCurrency(travelCost)}</span>
          </div>
          <div className="border-t border-zinc-800 pt-2 flex items-center justify-between text-sm font-medium">
            <span className="text-zinc-300">{t.markets.costs}</span>
            <span className="text-zinc-100">
              {formatCurrency(standFee + travelCost)}
            </span>
          </div>
        </div>
      </Card>

      {/* Sales Section */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {t.markets.sales}
          </h3>
          <button
            onClick={() => setShowAddSale(!showAddSale)}
            className="rounded-lg p-1.5 text-emerald-400 hover:bg-zinc-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Add Sale Form */}
        {showAddSale && (
          <form
            onSubmit={handleAddSale}
            className="mb-4 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
          >
            <input
              type="text"
              value={saleDescription}
              onChange={(e) => setSaleDescription(e.target.value)}
              className={inputClass}
              placeholder={t.markets.itemDescription}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={saleAmount}
                onChange={(e) => setSaleAmount(e.target.value)}
                className={inputClass}
                placeholder={t.expenses.amount}
                required
              />
              <input
                type="number"
                min="1"
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(e.target.value)}
                className={inputClass}
                placeholder={t.orders.qty}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={createSale.isPending}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {createSale.isPending ? t.common.loading : t.common.save}
              </button>
              <button
                type="button"
                onClick={() => setShowAddSale(false)}
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                {t.common.cancel}
              </button>
            </div>
          </form>
        )}

        {/* Sales List */}
        {!sales || sales.length === 0 ? (
          <p className="text-sm text-zinc-500">{t.markets.noSales}</p>
        ) : (
          <div className="space-y-2">
            {sales.map((sale: any) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-200 truncate">
                    {sale.description}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {Number(sale.quantity) > 1
                      ? `${sale.quantity} x ${formatCurrency(Number(sale.amount))}`
                      : formatCurrency(Number(sale.amount))}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-emerald-400">
                    {formatCurrency(Number(sale.amount) * Number(sale.quantity))}
                  </span>
                  <button
                    onClick={() => setConfirmDeleteSaleId(sale.id)}
                    className="rounded p-1 text-zinc-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sales Total */}
        {sales && sales.length > 0 && (
          <div className="mt-3 border-t border-zinc-800 pt-3 flex items-center justify-between text-sm font-medium">
            <span className="text-zinc-300">{t.orders.total}</span>
            <span className="text-emerald-400">
              {formatCurrency(totalSales)}
            </span>
          </div>
        )}
      </Card>

      {/* Profit */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {t.markets.profit}
          </h3>
          <span
            className={`text-xl font-bold ${
              profit >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {formatCurrency(profit)}
          </span>
        </div>
      </Card>

      {/* Delete Market Button */}
      <button
        onClick={() => setConfirmDeleteMarket(true)}
        className="w-full rounded-lg border border-red-500/20 bg-red-500/5 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
      >
        {t.markets.deleteMarket}
      </button>

      {/* Confirm Delete Market Dialog */}
      <ConfirmDialog
        open={confirmDeleteMarket}
        onClose={() => setConfirmDeleteMarket(false)}
        onConfirm={handleDeleteMarket}
        title={t.markets.deleteMarket}
        message={t.markets.deleteMarketConfirm}
        confirmText={t.markets.deleteAction}
        cancelText={t.markets.deleteCancel}
      />

      {/* Confirm Delete Sale Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteSaleId}
        onClose={() => setConfirmDeleteSaleId(null)}
        onConfirm={() => {
          if (confirmDeleteSaleId) handleDeleteSale(confirmDeleteSaleId);
        }}
        title={t.markets.deleteSale}
        message={t.markets.removeSale}
        confirmText={t.markets.deleteAction}
        cancelText={t.markets.deleteCancel}
      />
    </div>
  );
}
