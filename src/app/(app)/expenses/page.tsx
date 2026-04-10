"use client";

import { useState } from "react";
import { Receipt, Plus, Trash2, X } from "lucide-react";
import { useExpenses, useCreateExpense, useDeleteExpense } from "@/lib/hooks/useExpenses";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionBanner } from "@/components/ui/SubscriptionBanner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const CATEGORIES = [
  "Materials",
  "Shipping",
  "Subscriptions",
  "Tools",
  "Marketing",
  "Packaging",
  "Other",
] as const;

type Category = (typeof CATEGORIES)[number];

const categoryColors: Record<Category, string> = {
  Materials: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Shipping: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  Subscriptions: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Tools: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Marketing: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  Packaging: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  Other: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function ExpensesPage() {
  const { t } = useLanguage();
  const { data: expenses, isLoading } = useExpenses();
  const { data: sub } = useSubscription();
  const createExpense = useCreateExpense();
  const deleteExpense = useDeleteExpense();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Category>("Other");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const isSubscriptionInactive = sub && !sub.isActive;

  const totalExpenses = (expenses ?? []).reduce(
    (sum: number, e: any) => sum + (Number(e.amount) || 0),
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount.trim()) return;

    await createExpense.mutateAsync({
      description: description.trim(),
      amount: parseAmount(amount),
      category,
      expenseDate,
    });

    // Reset form
    setDescription("");
    setAmount("");
    setCategory("Other");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteExpense.mutateAsync(deleteId);
    setDeleteId(null);
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-primary placeholder-holder outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition-colors";

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
        <h1 className="text-2xl font-bold font-display text-primary">
          {t.expenses.title}
        </h1>
        {!isSubscriptionInactive && (
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

      {/* Total */}
      {expenses && expenses.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-faint">{t.expenses.total}</p>
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
                onChange={(e) => setCategory(e.target.value as Category)}
                className={inputClass}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t.expenses.categories[cat]}
                  </option>
                ))}
              </select>
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
          </form>
        </Card>
      )}

      {/* Expenses list */}
      {!expenses || expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-12 w-12" />}
          title={t.expenses.noExpenses}
          subtitle={t.expenses.noExpensesSub}
        />
      ) : (
        <div className="space-y-3">
          {[...expenses]
            .sort((a: any, b: any) => {
              const dateA = a.expenseDate ?? a.date ?? a.createdAt ?? "";
              const dateB = b.expenseDate ?? b.date ?? b.createdAt ?? "";
              return dateB.localeCompare(dateA);
            })
            .map((expense: any) => {
              const cat = (expense.category as Category) || "Other";
              const colors =
                categoryColors[cat] || categoryColors.Other;

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
                        {t.expenses.categories[cat as keyof typeof t.expenses.categories] ?? cat}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {expense.expenseDate ??
                        expense.date ??
                        (expense.createdAt
                          ? new Date(expense.createdAt)
                              .toISOString()
                              .slice(0, 10)
                          : "")}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-semibold text-brand-primary">
                      {formatCurrency(Number(expense.amount) || 0)}
                    </p>
                    <button
                      onClick={() => setDeleteId(expense.id)}
                      className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-elevated transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
