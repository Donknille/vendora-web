"use client";

import Link from "next/link";
import { Plus, ShoppingCart, Calendar, Package } from "lucide-react";
import { useOrders } from "@/lib/hooks/useOrders";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionBanner } from "@/components/ui/SubscriptionBanner";

export default function OrdersPage() {
  const { t } = useLanguage();
  const { data: orders, isLoading } = useOrders();

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
        <h1 className="text-2xl font-bold font-display text-primary">{t.orders.title}</h1>
        <Link
          href="/orders/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t.orders.newOrder}
        </Link>
      </div>

      <SubscriptionBanner />

      {/* Orders list */}
      {!orders || orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-12 w-12" />}
          title={t.orders.noOrders}
          subtitle={t.orders.noOrdersSub}
        />
      ) : (
        <div className="space-y-3">
          {[...orders]
            .sort((a: any, b: any) => {
              const dateA = a.orderDate || a.createdAt || "";
              const dateB = b.orderDate || b.createdAt || "";
              return dateB.localeCompare(dateA);
            })
            .map((order: any) => {
              const items = order.items || [];
              const total = items.reduce(
                (sum: number, item: any) =>
                  sum + Number(item.price || 0) * Number(item.quantity || 1),
                0
              );
              const itemCount = items.length;

              return (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <Card className="hover:border-line-hover transition-colors cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-primary truncate">
                            {order.customerName}
                          </h3>
                          {order.status && <StatusBadge status={order.status} />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-faint">
                          {order.invoiceNumber && (
                            <span className="text-muted">
                              #{order.invoiceNumber}
                            </span>
                          )}
                          {(order.orderDate || order.createdAt) && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {order.orderDate || order.createdAt?.split("T")[0]}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            {itemCount}{" "}
                            {itemCount === 1
                              ? t.orders.item
                              : t.orders.items_plural}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-brand-tealDark">
                          {formatCurrency(total)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
