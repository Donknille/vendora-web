"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMarkets, useUpdateMarket } from "@/lib/hooks/useMarkets";
import { useLanguage } from "@/lib/context/LanguageContext";
import { parseAmount } from "@/lib/formatCurrency";

interface QuickItem {
  name: string;
  price: string;
}

export default function EditMarketPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const marketId = params.id as string;

  const { data: markets, isLoading } = useMarkets();
  const updateMarket = useUpdateMarket();

  const market = markets?.find((m) => m.id === marketId);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [standFee, setStandFee] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [notes, setNotes] = useState("");
  const [quickItems, setQuickItems] = useState<QuickItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (market && !initialized) {
      setName(market.name || "");
      setDate(market.date || "");
      setLocation(market.location || "");
      setStandFee(
        Number(market.standFee)
          ? Number(market.standFee).toFixed(2).replace(".", ",")
          : ""
      );
      setTravelCost(
        Number(market.travelCost)
          ? Number(market.travelCost).toFixed(2).replace(".", ",")
          : ""
      );
      setNotes(market.notes || "");
      if (market.quickItems && market.quickItems.length > 0) {
        setQuickItems(
          market.quickItems.map((item) => ({
            name: item.name,
            price: item.price.toFixed(2).replace(".", ","),
          }))
        );
      }
      setInitialized(true);
    }
  }, [market, initialized]);

  const addQuickItem = () => {
    setQuickItems((prev) => [...prev, { name: "", price: "" }]);
  };

  const updateQuickItem = (index: number, field: keyof QuickItem, value: string) => {
    setQuickItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeQuickItem = (index: number) => {
    setQuickItems((prev) => prev.filter((_, i) => i !== index));
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const validItems = quickItems
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), price: parseAmount(item.price) }));

    await updateMarket.mutateAsync({
      id: marketId,
      name: name.trim(),
      date,
      location: location.trim(),
      standFee: parseAmount(standFee),
      travelCost: parseAmount(travelCost),
      notes: notes.trim(),
      quickItems: validItems,
    });

    router.push(`/markets/${marketId}`);
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/markets/${marketId}`}
          className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold font-display text-primary">
          {t.markets.editMarket}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Details */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-faint uppercase tracking-wider">
            {t.markets.eventDetails}
          </h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              {t.markets.marketName} *
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder={t.markets.marketName} required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">{t.orders.orderDate}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">{t.markets.location}</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder={t.markets.location} />
          </div>
        </div>

        {/* Costs */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-faint uppercase tracking-wider">{t.markets.costs}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t.markets.standFee}</label>
              <input type="text" inputMode="decimal" value={standFee} onChange={(e) => setStandFee(e.target.value)} className={inputClass} placeholder="0,00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">{t.markets.travelCost}</label>
              <input type="text" inputMode="decimal" value={travelCost} onChange={(e) => setTravelCost(e.target.value)} className={inputClass} placeholder="0,00" />
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-faint uppercase tracking-wider">{t.markets.articles}</h2>
            <button type="button" onClick={addQuickItem} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-teal hover:bg-brand-teal/10 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              {t.markets.addArticle}
            </button>
          </div>

          {quickItems.length === 0 ? (
            <button type="button" onClick={addQuickItem} className="w-full rounded-lg border border-dashed border-line py-6 text-sm text-muted hover:border-brand-teal hover:text-brand-teal transition-colors">
              <Plus className="h-5 w-5 mx-auto mb-1" />
              {t.markets.addArticle}
            </button>
          ) : (
            <div className="space-y-3">
              {quickItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3">
                  <div className="flex-1">
                    <input type="text" value={item.name} onChange={(e) => updateQuickItem(index, "name", e.target.value)} className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-primary placeholder-holder focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal transition-colors" placeholder={t.markets.articleName} />
                  </div>
                  <div className="w-28">
                    <input type="text" inputMode="decimal" value={item.price} onChange={(e) => updateQuickItem(index, "price", e.target.value)} className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-primary placeholder-holder focus:border-brand-teal focus:outline-none focus:ring-1 focus:ring-brand-teal transition-colors text-right" placeholder="0,00 €" />
                  </div>
                  <button type="button" onClick={() => removeQuickItem(index)} className="rounded-lg p-2 text-muted hover:text-red-400 hover:bg-elevated transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">{t.markets.notes}</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder={t.markets.additionalNotes} />
        </div>

        {/* Submit */}
        <button type="submit" disabled={updateMarket.isPending || !name.trim()} className="w-full rounded-lg bg-brand-primary py-3 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {updateMarket.isPending ? t.common.loading : t.markets.saveMarket}
        </button>
      </form>
    </div>
  );
}
