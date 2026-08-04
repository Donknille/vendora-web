// Shared (client + server) order-status helpers.

// Statuses that count as "money received" for revenue/EÜR purposes.
export const PAID_LIKE_STATUSES = ["paid", "shipped", "delivered"] as const;

export function isPaidLike(status: string | null | undefined): boolean {
  return status != null && (PAID_LIKE_STATUSES as readonly string[]).includes(status);
}
