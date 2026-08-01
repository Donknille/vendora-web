"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  X,
  Minus,
  Plus,
  Undo2,
  Banknote,
  CreditCard,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useMarketSales, useDeleteMarketSale } from "@/lib/hooks/useMarketSales";
import { useCanCreate } from "@/lib/hooks/useSubscription";
import { useOfflineSales } from "@/lib/offline/useOfflineSales";
import type { SalePaymentMethod } from "@/lib/offline/salesQueue";
import { computeDayClosing } from "@/lib/marketDay";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, formatDate, parseAmount } from "@/lib/formatCurrency";
import { TseNotice } from "@/components/markets/TseNotice";

export default function MarketPosPage() {
  const { t, language } = useLanguage();
  const de = language === "de";
  const params = useParams();
  const marketId = params.id as string;

  const { data: markets, isLoading } = useMarkets();
  const { data: sales } = useMarketSales(marketId);
  const deleteSale = useDeleteMarketSale();
  const canCreate = useCanCreate();
  const { pending, syncing, recordSale, dequeue } = useOfflineSales(marketId);

  const [payment, setPayment] = useState<SalePaymentMethod>("cash");
  const [qty, setQty] = useState(1);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Free-amount entry
  const [freeDesc, setFreeDesc] = useState("");
  const [freeAmount, setFreeAmount] = useState("");

  const market = markets?.find((m) => m.id === marketId);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-page">
        <p className="text-muted">{t.common.loading}</p>
      </div>
    );
  }
  if (!market) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-page">
        <p className="text-muted">{t.markets.noMarkets}</p>
        <Link href="/markets" className="text-brand-primary underline">
          {t.markets.title}
        </Link>
      </div>
    );
  }

  const standFee = Number(market.standFee) || 0;
  const travelCost = Number(market.travelCost) || 0;

  const serverClientIds = new Set(
    (sales ?? []).map((s) => s.clientId).filter(Boolean) as string[]
  );
  const unsynced = pending.filter((p) => !serverClientIds.has(p.clientId));

  const closing = computeDayClosing(
    [
      ...(sales ?? []).map((s) => ({
        amount: Number(s.amount),
        quantity: Number(s.quantity),
        paymentMethod: s.paymentMethod,
      })),
      ...unsynced.map((p) => ({
        amount: p.amount,
        quantity: p.quantity,
        paymentMethod: p.paymentMethod,
      })),
    ],
    standFee,
    travelCost
  );

  const soldCount = (name: string, price: number) => {
    const s = (sales ?? [])
      .filter((x) => x.description === name && Number(x.amount) === price)
      .reduce((sum, x) => sum + Number(x.quantity), 0);
    const p = unsynced
      .filter((x) => x.description === name && x.amount === price)
      .reduce((sum, x) => sum + x.quantity, 0);
    return s + p;
  };

  const record = async (description: string, amount: number) => {
    setError("");
    if (!canCreate) {
      setError(
        de
          ? "Nur-Lese-Modus – für neue Verkäufe wird Vendora Pro benötigt."
          : "Read-only – Vendora Pro is required to record sales."
      );
      return;
    }
    try {
      const cid = await recordSale({ description, amount, quantity: qty, paymentMethod: payment });
      setUndoStack((s) => [...s, cid]);
      setQty(1);
    } catch {
      setError(de ? "Verkauf konnte nicht gespeichert werden." : "Could not save sale.");
    }
  };

  const handleFreeSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeDesc.trim() || !freeAmount.trim()) return;
    await record(freeDesc.trim(), parseAmount(freeAmount));
    setFreeDesc("");
    setFreeAmount("");
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const stack = [...undoStack];
    const cid = stack.pop()!;
    setUndoStack(stack);
    // Not yet synced → remove from the queue; already on the server → delete it.
    if (pending.some((s) => s.clientId === cid)) {
      await dequeue(cid);
      return;
    }
    const server = (sales ?? []).find((s) => s.clientId === cid);
    if (server) {
      try {
        await deleteSale.mutateAsync(server.id);
      } catch {
        setError(de ? "Rückgängig fehlgeschlagen." : "Undo failed.");
      }
    }
  };

  const quickItems = market.quickItems ?? [];

  const payBtn = (method: SalePaymentMethod, label: string, Icon: typeof Banknote) => (
    <button
      onClick={() => setPayment(method)}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        payment === method
          ? "bg-brand-primary text-white"
          : "text-secondary hover:bg-elevated"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-primary">{market.name}</h1>
          <p className="truncate text-xs text-faint">
            {market.date && formatDate(market.date, de ? "de-DE" : "en-US")}
            {market.location ? ` · ${market.location}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {syncing ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            </span>
          ) : unsynced.length > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
              <RefreshCw className="h-3 w-3" />
              {unsynced.length}
            </span>
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          <Link
            href={`/markets/${marketId}`}
            className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-secondary transition-colors"
            aria-label={de ? "Kasse schließen" : "Close register"}
          >
            <X className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Controls: payment method + quantity */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <div className="inline-flex flex-1 rounded-lg border border-line p-0.5">
          {payBtn("cash", de ? "Bar" : "Cash", Banknote)}
          {payBtn("card", de ? "Karte" : "Card", CreditCard)}
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="text-xs text-faint">{de ? "Menge" : "Qty"}</span>
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="rounded-lg border border-line p-2 text-secondary hover:bg-elevated active:scale-95 transition-all"
            aria-label={de ? "Menge verringern" : "Decrease quantity"}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-lg font-bold text-primary tabular-nums">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(999, q + 1))}
            className="rounded-lg border border-line p-2 text-secondary hover:bg-elevated active:scale-95 transition-all"
            aria-label={de ? "Menge erhöhen" : "Increase quantity"}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Sell area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {quickItems.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {quickItems.map((item, idx) => {
              const count = soldCount(item.name, item.price);
              return (
                <button
                  key={idx}
                  onClick={() => record(item.name, item.price)}
                  className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface p-4 hover:border-brand-primary hover:bg-brand-primary/5 active:scale-95 transition-all"
                >
                  <span className="w-full truncate text-center text-base font-semibold text-primary">
                    {item.name}
                  </span>
                  <span className="text-xl font-bold text-green-600">
                    {formatCurrency(item.price)}
                  </span>
                  {count > 0 && (
                    <span className="text-xs text-muted">
                      {count}× {t.markets.sold}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Free amount */}
        <form onSubmit={handleFreeSale} className="rounded-2xl border border-line bg-surface p-3 space-y-3">
          <p className="text-sm font-medium text-faint">{t.markets.otherSale}</p>
          <input
            type="text"
            value={freeDesc}
            onChange={(e) => setFreeDesc(e.target.value)}
            placeholder={t.markets.itemDescription}
            className="w-full rounded-lg border border-line bg-input px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            required
          />
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={freeAmount}
              onChange={(e) => setFreeAmount(e.target.value)}
              placeholder={t.expenses.amount}
              className="flex-1 rounded-lg border border-line bg-input px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary/90 active:scale-95 transition-all"
            >
              {de ? "Buchen" : "Add"}
            </button>
          </div>
        </form>

        <TseNotice />
      </div>

      {/* Footer: live totals + undo */}
      <footer className="border-t border-line bg-surface px-4 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">{de ? "Bar" : "Cash"}</p>
            <p className="text-sm font-semibold text-primary tabular-nums">{formatCurrency(closing.cash)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">{de ? "Karte" : "Card"}</p>
            <p className="text-sm font-semibold text-primary tabular-nums">{formatCurrency(closing.card)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-faint">{t.orders.total}</p>
            <p className="text-sm font-bold text-green-600 tabular-nums">{formatCurrency(closing.total)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-secondary hover:bg-elevated disabled:opacity-40 transition-colors"
          >
            <Undo2 className="h-4 w-4" />
            {de ? "Rückgängig" : "Undo"}
          </button>
          <div className="ml-auto text-right">
            <span className="text-[11px] uppercase tracking-wide text-faint">{t.markets.profit}: </span>
            <span className={`text-sm font-bold tabular-nums ${closing.profit >= 0 ? "text-green-600" : "text-brand-primary"}`}>
              {formatCurrency(closing.profit)}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
