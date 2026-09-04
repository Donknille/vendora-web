import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orderStatus";

/**
 * Wertübersetzung für den Backup-Import.
 *
 * Ein Backup kann aus einer älteren Version stammen oder von Hand bearbeitet
 * worden sein. Vorher liefen solche Werte ungeprüft in die Datenbank, und die
 * dortigen CHECK-Constraints warfen den GANZEN Import zurück — die Nutzerin
 * sah nur „Import failed", ohne Hinweis, welcher Wert schuld war. Wie bei
 * `mapLegacyCategory` in euer.ts wird hier übersetzt statt abgebrochen.
 */

const MARKET_STATUSES = ["open", "applied", "confirmed", "completed", "cancelled"] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

const LEGACY_PAYMENT_METHODS: Record<string, PaymentMethod> = {
  bar: "cash",
  cash: "cash",
  bargeld: "cash",
  karte: "card",
  card: "card",
  ec: "card",
  kreditkarte: "card",
  "überweisung": "transfer",
  ueberweisung: "transfer",
  transfer: "transfer",
  banktransfer: "transfer",
  paypal: "paypal",
  sonstiges: "other",
  other: "other",
};

/** Unbekannte oder leere Zahlungsart wird `null` (= nicht angegeben). */
export function mapLegacyPaymentMethod(value: string | null | undefined): PaymentMethod | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if ((PAYMENT_METHODS as readonly string[]).includes(key)) return key as PaymentMethod;
  return Object.hasOwn(LEGACY_PAYMENT_METHODS, key) ? LEGACY_PAYMENT_METHODS[key] : null;
}

const LEGACY_ORDER_STATUSES: Record<string, OrderStatus> = {
  offen: "open",
  bezahlt: "paid",
  versendet: "shipped",
  versandt: "shipped",
  geliefert: "delivered",
  storniert: "cancelled",
  canceled: "cancelled",
};

/** Unbekannter Auftragsstatus fällt auf „offen" zurück. */
export function mapLegacyOrderStatus(value: string | null | undefined): OrderStatus {
  if (!value) return "open";
  const key = value.trim().toLowerCase();
  if ((ORDER_STATUSES as readonly string[]).includes(key)) return key as OrderStatus;
  return Object.hasOwn(LEGACY_ORDER_STATUSES, key) ? LEGACY_ORDER_STATUSES[key] : "open";
}

const LEGACY_MARKET_STATUSES: Record<string, MarketStatus> = {
  offen: "open",
  beworben: "applied",
  angemeldet: "applied",
  zugesagt: "confirmed",
  bestätigt: "confirmed",
  abgeschlossen: "completed",
  abgesagt: "cancelled",
  canceled: "cancelled",
};

/** Unbekannter Marktstatus fällt auf „offen" zurück. */
export function mapLegacyMarketStatus(value: string | null | undefined): MarketStatus {
  if (!value) return "open";
  const key = value.trim().toLowerCase();
  if ((MARKET_STATUSES as readonly string[]).includes(key)) return key as MarketStatus;
  return Object.hasOwn(LEGACY_MARKET_STATUSES, key) ? LEGACY_MARKET_STATUSES[key] : "open";
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const GERMAN_DAY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/**
 * Bringt ein Datum auf `YYYY-MM-DD` — ohne `Date()`, damit keine Zeitzone
 * den Tag verschiebt. Versteht ISO-Tage, ISO-Zeitstempel und die deutsche
 * Schreibweise `31.12.2026`. Alles andere ergibt `null`; der Aufrufer
 * entscheidet über den Rückfall.
 *
 * Vorher landete „31.12.2026" unverändert in einer `date`-Spalte — das
 * scheiterte entweder in Postgres oder, schlimmer, die Zeile blieb stehen
 * und war in jedem Report unsichtbar, weil die EÜR nur `YYYY-MM…` liest.
 */
export function normalizeLegacyDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim();
  const iso = ISO_DAY.exec(text);
  if (iso) return validDay(iso[1], iso[2], iso[3]);
  const de = GERMAN_DAY.exec(text);
  if (de) return validDay(de[3], de[2].padStart(2, "0"), de[1].padStart(2, "0"));
  return null;
}

function validDay(y: string, m: string, d: string): string | null {
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${m}-${d}`;
}
