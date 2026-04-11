"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCreateMarket } from "@/lib/hooks/useMarkets";
import { useLanguage } from "@/lib/context/LanguageContext";
import { parseAmount } from "@/lib/formatCurrency";

interface QuickItem {
  name: string;
  price: string;
}

export default function NewMarketPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const createMarket = useCreateMarket();

  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [standFee, setStandFee] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [notes, setNotes] = useState("");
  const [quickItems, setQuickItems] = useState<QuickItem[]>([]);

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

  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;

    const validItems = quickItems
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), price: parseAmount(item.price) }));

    try {
    await createMarket.mutateAsync({
      name: name.trim(),
      date,
      location: location.trim(),
      standFee: parseAmount(standFee),
      travelCost: parseAmount(travelCost),
      notes: notes.trim(),
      ...(validItems.length > 0 ? { quickItems: validItems } : {}),
    });

    router.push("/markets");
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/markets"
          className="rounded-lg p-2 text-faint hover:bg-elevated hover:text-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-primary">
          {t.markets.newMarket}
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
            <label className="mb-1 block text-sm font-medium text-secondary">
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
            <label className="mb-1 block text-sm font-medium text-secondary">
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
          <h2 className="text-sm font-medium text-faint uppercase tracking-wider">
            {t.markets.costs}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
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
              <label className="mb-1 block text-sm font-medium text-secondary">
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

        {/* Articles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-faint uppercase tracking-wider">
              {t.markets.articles}
            </h2>
            <button
              type="button"
              onClick={addQuickItem}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.markets.addArticle}
            </button>
          </div>

          {quickItems.length === 0 ? (
            <button
              type="button"
              onClick={addQuickItem}
              className="w-full rounded-lg border border-dashed border-line py-6 text-sm text-muted hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              <Plus className="h-5 w-5 mx-auto mb-1" />
              {t.markets.addArticle}
            </button>
          ) : (
            <div className="space-y-3">
              {quickItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3"
                >
                  <div className="flex-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateQuickItem(index, "name", e.target.value)}
                      className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-primary placeholder-holder focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-colors"
                      placeholder={t.markets.articleName}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(e) => updateQuickItem(index, "price", e.target.value)}
                      className="w-full rounded-lg border border-line bg-page px-3 py-2 text-sm text-primary placeholder-holder focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary transition-colors text-right"
                      placeholder="0,00 €"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuickItem(index)}
                    className="rounded-lg p-2 text-muted hover:text-red-400 hover:bg-elevated transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
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

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Submit */}
        <button
          type="submit"
          disabled={createMarket.isPending || !name.trim()}
          className="w-full rounded-lg bg-brand-primary py-3 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createMarket.isPending
            ? t.common.loading
            : t.markets.createMarket}
        </button>
      </form>
    </div>
  );
}
