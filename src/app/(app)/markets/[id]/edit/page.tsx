"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useMarkets, useUpdateMarket } from "@/lib/hooks/useMarkets";
import { useLanguage } from "@/lib/context/LanguageContext";
import { parseAmount } from "@/lib/formatCurrency";

export default function EditMarketPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const marketId = params.id as string;

  const { data: markets, isLoading } = useMarkets();
  const updateMarket = useUpdateMarket();

  const market = markets?.find((m: any) => m.id === marketId);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [standFee, setStandFee] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [notes, setNotes] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Pre-fill form when market data loads
  useEffect(() => {
    if (market && !initialized) {
      setName(market.name || "");
      setDate(market.date || "");
      setLocation(market.location || "");
      setStandFee(
        Number(market.standFee)
          ? String(Number(market.standFee)).replace(".", ",")
          : ""
      );
      setTravelCost(
        Number(market.travelCost)
          ? String(Number(market.travelCost)).replace(".", ",")
          : ""
      );
      setNotes(market.notes || "");
      setInitialized(true);
    }
  }, [market, initialized]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await updateMarket.mutateAsync({
      id: marketId,
      name: name.trim(),
      date,
      location: location.trim(),
      standFee: parseAmount(standFee),
      travelCost: parseAmount(travelCost),
      notes: notes.trim(),
    });

    router.push(`/markets/${marketId}`);
  };

  const inputClass =
    "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/markets/${marketId}`}
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">
          {t.markets.marketDetails}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {t.markets.eventDetails}
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              {t.markets.marketName} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder={t.markets.marketName}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              {t.orders.orderDate}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-300">
              {t.markets.location}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
              placeholder={t.markets.location}
            />
          </div>
        </div>

        {/* Costs */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {t.markets.costs}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                {t.markets.standFee}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={standFee}
                onChange={(e) => setStandFee(e.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-300">
                {t.markets.travelCost}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={travelCost}
                onChange={(e) => setTravelCost(e.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-300">
            {t.markets.notes}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
            rows={3}
            placeholder={t.markets.additionalNotes}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={updateMarket.isPending || !name.trim()}
          className="w-full rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {updateMarket.isPending ? t.common.loading : t.common.save}
        </button>
      </form>
    </div>
  );
}
