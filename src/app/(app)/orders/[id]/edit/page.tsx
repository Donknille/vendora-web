"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useOrders, useUpdateOrder } from "@/lib/hooks/useOrders";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";

interface OrderItem {
  name: string;
  quantity: string;
  price: string;
}

export default function EditOrderPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: orders, isLoading } = useOrders();
  const updateOrder = useUpdateOrder();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("open");
  const [items, setItems] = useState<OrderItem[]>([
    { name: "", quantity: "1", price: "" },
  ]);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);

  const order = orders?.find((o: any) => o.id === id);

  // Pre-fill form with existing order data
  useEffect(() => {
    if (order && !initialized) {
      setCustomerName(order.customerName || "");
      setCustomerEmail(order.customerEmail || "");
      setCustomerAddress(order.customerAddress || "");
      setOrderDate(
        order.orderDate || order.createdAt?.split("T")[0] || ""
      );
      setNotes(order.notes || "");
      setStatus(order.status || "open");

      if (order.items && order.items.length > 0) {
        setItems(
          order.items.map((item: any) => ({
            name: item.name || "",
            quantity: String(item.quantity || 1),
            price: String(item.price || ""),
          }))
        );
      }
      setInitialized(true);
    }
  }, [order, initialized]);

  const updateItem = (index: number, field: keyof OrderItem, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { name: "", quantity: "1", price: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = parseAmount(item.price);
    return sum + qty * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customerName.trim()) {
      setError(t.orders.enterCustomerName);
      return;
    }

    const hasEmptyName = items.some((item) => !item.name.trim());
    if (hasEmptyName) {
      setError(t.orders.fillItemNames);
      return;
    }

    const orderItems = items.map((item) => ({
      name: item.name.trim(),
      quantity: Number(item.quantity) || 1,
      price: parseAmount(item.price),
    }));

    try {
      await updateOrder.mutateAsync({
        id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        orderDate,
        notes: notes.trim() || undefined,
        items: orderItems,
        status,
      });
      router.push(`/orders/${id}`);
    } catch {
      setError(t.orders.missingInfo);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">{t.common.loading}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-500">{t.orders.noOrders}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/orders/${id}`}
          className="rounded-lg p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-100">
          {t.orders.orderDetails}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            {t.orders.customer}
          </h2>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t.orders.customerName} *
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder={t.orders.customerName}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t.orders.email}
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder={t.orders.email}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t.orders.address}
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              placeholder={t.orders.address}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              {t.orders.orderDate}
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {t.orders.items}
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-500 hover:bg-emerald-500/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.orders.item}
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
              >
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                    placeholder={t.orders.itemName}
                  />
                  <div className="flex gap-2">
                    <div className="w-24">
                      <label className="block text-xs text-zinc-500 mb-1">
                        {t.orders.qty}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-zinc-500 mb-1">
                        {t.orders.price}
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(index, "price", e.target.value)
                        }
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-1 rounded-lg p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <span className="text-sm font-medium text-zinc-300">
              {t.orders.total}
            </span>
            <span className="text-lg font-bold text-emerald-400">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            {t.orders.notes}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
            placeholder={t.orders.additionalNotes}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={updateOrder.isPending}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {updateOrder.isPending ? t.common.loading : t.common.save}
        </button>
      </form>
    </div>
  );
}
