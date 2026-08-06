"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Plus, Trash2, X, Store } from "lucide-react";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/lib/hooks/useExpenses";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, formatDate, parseAmount } from "@/lib/formatCurrency";
import { EUER_CATEGORIES, euerLabel, isEuerCategory, type EuerCategory } from "@/lib/euer";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionBanner } from "@/components/ui/SubscriptionBanner";
import { useCanCreate } from "@/lib/hooks/useSubscription";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton, ListSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";

const categoryColors: Record<EuerCategory, string> = {
  wareneinkauf_material: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  standgebuehren_raumkosten: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  fahrtkosten: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  arbeitsmittel_gwg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  verpackung: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  marketing: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  versicherungen_beitraege: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  software_gebuehren: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  sonstiges: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

/** Year of a date-only or full ISO string, without going through Date(). */
function yearOf(dateStr: string | null | undefined): number | null {
  if (!dateStr || dateStr.length < 4) return null;
  const y = Number(dateStr.slice(0, 4));
  return Number.isInteger(y) ? y : null;
}

export default function ExpensesPage() {
  const { t, language } = useLanguage();
  const { data: expenses, isLoading, isError, refetch } = useExpenses();
  // Nur fuer die Marktnamen der abgeleiteten Zeilen. Bewusst nicht in
  // isLoading/isError: ein Fehler hier darf die Ausgabenliste nicht ersetzen,
  // der Badge zeigt dann eben keinen Namen.
  const { data: markets } = useMarkets();
  const canCreate = useCanCreate();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<EuerCategory>("sonstiges");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Jahresfilter wie auf /steuer — ohne ihn zeigt die Summe hier alle Jahre
  // und laesst sich mit Dashboard und EÜR gar nicht vergleichen.
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear()]);
    (expenses ?? []).forEach((e) => {
      const y = yearOf(e.expenseDate ?? e.createdAt);
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses]);

  // Der Server sortiert bereits nach Belegdatum absteigend.
  const visibleExpenses = useMemo(
    () => (expenses ?? []).filter((e) => yearOf(e.expenseDate ?? e.createdAt) === selectedYear),
    [expenses, selectedYear],
  );

  const marketNameById = useMemo(
    () => new Map((markets ?? []).map((m) => [m.id, m.name])),
    [markets],
  );

  const totalExpenses = visibleExpenses.reduce(
    (sum: number, e) => sum + (Number(e.amount) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!description.trim() || !amount.trim()) return;

    try {
      await createExpense.mutateAsync({
        description: description.trim(),
        amount: parseAmount(amount),
        category,
        expenseDate,
      });

      // Reset form
      setDescription("");
      setAmount("");
      setCategory("sonstiges");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setShowForm(false);
    } catch {
      setFormError(language === "en" ? "Could not save expense. Please try again." : "Ausgabe konnte nicht gespeichert werden. Bitte versuche es erneut.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteExpense.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors";

  if (isLoading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-8 w-48" /><ListSkeleton count={4} /></div>;
  if (isError) return <div className="mx-auto max-w-2xl"><ErrorState onRetry={() => refetch()} /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">
          {t.expenses.title}
        </h1>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
          >
            {showForm ? (
              <>
                <X className="h-4 w-4" />
                {t.expenses.cancel}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {t.expenses.newExpense}
              </>
            )}
          </button>
        )}
      </div>

      <SubscriptionBanner />

      {/* Year filter */}
      {availableYears.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedYear === year
                  ? "bg-brand-primary text-white"
                  : "bg-elevated text-faint hover:bg-hover hover:text-secondary"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Total */}
      {visibleExpenses.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-faint">
              {t.expenses.total} {selectedYear}
            </p>
            <p className="text-2xl font-bold text-brand-primary">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
        </Card>
      )}

      {/* Add expense form */}
      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-medium text-faint uppercase tracking-wider">
              {t.expenses.newExpense}
            </h2>

            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t.expenses.description} *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass}
                placeholder={t.expenses.whatSpent}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t.expenses.amount} *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  {t.expenses.expenseDate}
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                {t.expenses.category}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EuerCategory)}
                className={inputClass}
              >
                {EUER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {euerLabel(cat, language)}
                  </option>
                ))}
              </select>
              {/* Standgebuehr und Fahrtkosten eines Markts stehen schon in der
                  Liste — ohne diesen Hinweis bucht man sie ein zweites Mal. */}
              {(category === "standgebuehren_raumkosten" || category === "fahrtkosten") && (
                <p className="mt-1.5 text-xs text-muted">
                  {language === "de"
                    ? "Standgebühren und Fahrtkosten eines Markts werden automatisch erfasst — du findest sie hier mit dem Markt-Hinweis."
                    : "Stand fees and travel costs of a market are recorded automatically — they appear here with a market badge."}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                createExpense.isPending ||
                !description.trim() ||
                !amount.trim()
              }
              className="w-full rounded-lg bg-brand-primary py-3 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createExpense.isPending
                ? t.common.loading
                : t.expenses.addExpense}
            </button>

            {formError && (
              <p className="mt-2 text-sm text-red-400">{formError}</p>
            )}
          </form>
        </Card>
      )}

      {/* Expenses list */}
      {visibleExpenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-12 w-12" />}
          title={t.expenses.noExpenses}
          subtitle={t.expenses.noExpensesSub}
        />
      ) : (
        <div className="space-y-3">
          {visibleExpenses
            .map((expense) => {
              const cat: EuerCategory = isEuerCategory(expense.category)
                ? expense.category
                : "sonstiges";
              const colors = categoryColors[cat];
              // Aus einem Markt abgeleitet: nur dort aenderbar, deshalb hier
              // kein Loeschen (der Server antwortet darauf ohnehin mit 409).
              const isDerived = expense.source !== "manual";

              return (
                <Card
                  key={expense.id}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-primary truncate">
                        {expense.description}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colors}`}
                      >
                        {euerLabel(cat, language)}
                      </span>
                      {isDerived && (
                        <Link
                          href={expense.marketId ? `/markets/${expense.marketId}` : "/markets"}
                          className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:text-secondary hover:bg-elevated transition-colors"
                        >
                          <Store className="h-3 w-3" />
                          {expense.marketId && marketNameById.get(expense.marketId)
                            ? `${t.expenses.fromMarket}: ${marketNameById.get(expense.marketId)}`
                            : t.expenses.fromMarket}
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(
                        expense.expenseDate ??
                          (expense.createdAt
                            ? new Date(expense.createdAt)
                                .toISOString()
                                .slice(0, 10)
                            : ""),
                        language === "de" ? "de-DE" : "en-US"
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-semibold text-brand-primary">
                      {formatCurrency(Number(expense.amount) || 0)}
                    </p>
                    {!isDerived && (
                      <button
                        onClick={() => setDeleteId(expense.id)}
                        aria-label={t.expenses.deleteExpense}
                        className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-elevated transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t.expenses.deleteExpense}
        message={t.expenses.areYouSure}
        confirmText={t.expenses.delete}
        cancelText={t.expenses.cancel}
      />
    </div>
  );
}
