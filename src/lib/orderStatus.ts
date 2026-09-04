// Shared (client + server) order-status helpers.

// Spiegelt chk_orders_status in schema.ts — beide Listen muessen gleich sein.
export const ORDER_STATUSES = ["open", "paid", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Statuses that count as "money received" for revenue/EÜR purposes.
export const PAID_LIKE_STATUSES = ["paid", "shipped", "delivered"] as const;

export function isPaidLike(status: string | null | undefined): boolean {
  return status != null && (PAID_LIKE_STATUSES as readonly string[]).includes(status);
}
