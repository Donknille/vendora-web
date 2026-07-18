// Shared (client + server) definitions for order payment methods.

export const PAYMENT_METHODS = ["cash", "card", "transfer", "paypal", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { de: string; en: string }> = {
  cash: { de: "Bar", en: "Cash" },
  card: { de: "Karte", en: "Card" },
  transfer: { de: "Überweisung", en: "Bank transfer" },
  paypal: { de: "PayPal", en: "PayPal" },
  other: { de: "Sonstiges", en: "Other" },
};

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
