"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMarkets, useUpdateMarket } from "@/lib/hooks/useMarkets";
import { useLanguage } from "@/lib/context/LanguageContext";
import { apiErrorMessage } from "@/lib/apiError";
import { parseAmount, formatAmountInput } from "@/lib/formatCurrency";
import { MARKET_STATUSES, statusLabel, type MarketStatus } from "@/lib/marketCalendar";
import { ghostBrandButton, iconButtonMuted, inputNested, labelTight, inputSurface } from "@/lib/styles";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { NotFoundState } from "@/components/ui/NotFoundState";
import { ErrorState } from "@/components/ui/ErrorState";

interface QuickItem {
  name: string;
  price: string;
}

export default function EditMarketPage() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const marketId = params.id as string;

  const { data: markets, isLoading, isError, refetch } = useMarkets();
  const updateMarket = useUpdateMarket();

  const market = markets?.find((m) => m.id === marketId);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<MarketStatus>("open");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [standFee, setStandFee] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [notes, setNotes] = useState("");
  const [quickItems, setQuickItems] = useState<QuickItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");

  // Populate form when server data arrives (sync from external system)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (market && !initialized) {
      setName(market.name || "");
      setDate(market.date || "");
      setLocation(market.location || "");
      setStatus((market.status as MarketStatus) || "open");
      setApplicationDeadline(market.applicationDeadline || "");
      setStandFee(market.standFee ? formatAmountInput(market.standFee) : "");
      setTravelCost(market.travelCost ? formatAmountInput(market.travelCost) : "");
      setNotes(market.notes || "");
      if (market.quickItems && market.quickItems.length > 0) {
        setQuickItems(
          market.quickItems.map((item) => ({
            name: item.name,
            price: formatAmountInput(item.price),
          }))
        );
      }
      setInitialized(true);
    }
  }, [market, initialized]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      <ListSkeleton count={3} />
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!market) {
    return (
      <NotFoundState backHref="/markets" />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;

    const validItems = quickItems
      .filter((item) => item.name.trim())
      .map((item) => ({ name: item.name.trim(), price: parseAmount(item.price) }));

    try {
      await updateMarket.mutateAsync({
        id: marketId,
        name: name.trim(),
        date,
        location: location.trim(),
        status,
        applicationDeadline: applicationDeadline || null,
        standFee: parseAmount(standFee),
        travelCost: parseAmount(travelCost),
        notes: notes.trim(),
        quickItems: validItems,
      });
      router.push(`/markets/${marketId}`);
    } catch (e) {
      setError(apiErrorMessage(e, language, t.common.saveError));
    }
  };


  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/markets/${marketId}`}
          className={iconButtonMuted}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-primary">
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
            <label htmlFor="market-edit-1" className={labelTight}>
              {t.markets.marketName} *
            </label>
            <input id="market-edit-1" type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputSurface} placeholder={t.markets.marketName} required />
          </div>
          <div>
            <label htmlFor="market-edit-2" className={labelTight}>{t.orders.orderDate}</label>
            <input id="market-edit-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputSurface} />
          </div>
          <div>
            <label htmlFor="market-edit-3" className={labelTight}>{t.markets.location}</label>
            <input id="market-edit-3" type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputSurface} placeholder={t.markets.location} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="market-edit-4" className={labelTight}>Status</label>
              <select id="market-edit-4" value={status} onChange={(e) => setStatus(e.target.value as MarketStatus)} className={inputSurface}>
                {MARKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, language === "de")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="market-edit-5" className={labelTight}>
                {t.markets.applicationDeadline}
              </label>
              <input id="market-edit-5" type="date" value={applicationDeadline} onChange={(e) => setApplicationDeadline(e.target.value)} className={inputSurface} />
            </div>
          </div>
        </div>

        {/* Costs */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-faint uppercase tracking-wider">{t.markets.costs}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="market-edit-6" className={labelTight}>{t.markets.standFee}</label>
              <input id="market-edit-6" type="text" inputMode="decimal" value={standFee} onChange={(e) => setStandFee(e.target.value)} className={inputSurface} placeholder="0,00" />
            </div>
            <div>
              <label htmlFor="market-edit-7" className={labelTight}>{t.markets.travelCost}</label>
              <input id="market-edit-7" type="text" inputMode="decimal" value={travelCost} onChange={(e) => setTravelCost(e.target.value)} className={inputSurface} placeholder="0,00" />
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-faint uppercase tracking-wider">{t.markets.articles}</h2>
            <button type="button" onClick={addQuickItem} className={ghostBrandButton}>
              <Plus className="h-3.5 w-3.5" />
              {t.markets.addArticle}
            </button>
          </div>

          {quickItems.length === 0 ? (
            <button type="button" onClick={addQuickItem} className="w-full rounded-lg border border-dashed border-line py-6 text-sm text-muted hover:border-brand-primary hover:text-brand-primary transition-colors">
              <Plus className="h-5 w-5 mx-auto mb-1" />
              {t.markets.addArticle}
            </button>
          ) : (
            <div className="space-y-3">
              {quickItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-3">
                  <div className="flex-1">
                    <input type="text" value={item.name} onChange={(e) => updateQuickItem(index, "name", e.target.value)} className={inputNested} placeholder={t.markets.articleName} />
                  </div>
                  <div className="w-28">
                    <input type="text" inputMode="decimal" value={item.price} onChange={(e) => updateQuickItem(index, "price", e.target.value)} className={`${inputNested} text-right`} placeholder="0,00 €" />
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
          <label htmlFor="market-edit-8" className={labelTight}>{t.markets.notes}</label>
          <textarea id="market-edit-8" value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputSurface} resize-none`} rows={3} placeholder={t.markets.additionalNotes} />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Submit */}
        <button type="submit" disabled={updateMarket.isPending || !name.trim()} className="w-full rounded-lg bg-brand-primary py-3 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {updateMarket.isPending ? t.common.loading : t.markets.saveMarket}
        </button>
      </form>
    </div>
  );
}
