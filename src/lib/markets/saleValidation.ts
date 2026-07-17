import { z } from "zod";

// ============================================================
// Shared validation for market-sale writes (single + batch route).
// Kept framework-agnostic and side-effect free so it can be unit
// tested with an injectable clock (see Phase 6).
// ============================================================

// V2: created_at plausibility window.
export const CREATED_AT_MAX_FUTURE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const CREATED_AT_MAX_PAST_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Format-only schema. The sale time (createdAt) comes from the client as an
// ISO-8601 string (V2); its plausibility is checked separately so the schema
// stays pure. The primary key `id` is never accepted from the client (V1).
export const marketSaleInputSchema = z.object({
  clientId: z.uuid(),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().min(0).max(999999.99),
  quantity: z.number().int().min(1).max(9999).default(1),
  createdAt: z.iso.datetime({ offset: true }),
});

export type MarketSaleInput = z.infer<typeof marketSaleInputSchema>;

export type CreatedAtCheck = { ok: true } | { ok: false; message: string };

/**
 * V2: created_at must not be more than 24h in the future nor more than 90 days
 * in the past. `now` is injectable for deterministic tests.
 */
export function checkCreatedAtPlausible(
  createdAt: string,
  now: number = Date.now()
): CreatedAtCheck {
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) {
    return { ok: false, message: "createdAt ist kein gültiger Zeitstempel" };
  }
  if (ts > now + CREATED_AT_MAX_FUTURE_MS) {
    return {
      ok: false,
      message: "createdAt liegt mehr als 24 Stunden in der Zukunft",
    };
  }
  if (ts < now - CREATED_AT_MAX_PAST_MS) {
    return {
      ok: false,
      message: "createdAt liegt mehr als 90 Tage in der Vergangenheit",
    };
  }
  return { ok: true };
}

export type ValidatedSale =
  | { ok: true; data: MarketSaleInput }
  | { ok: false; message: string };

/**
 * Parses and fully validates a single raw sale entry (format + createdAt
 * plausibility). Used per-entry by the batch route so one bad entry never
 * aborts the batch.
 */
export function validateMarketSaleInput(
  raw: unknown,
  now: number = Date.now()
): ValidatedSale {
  const parsed = marketSaleInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Ungültiger Eintrag",
    };
  }
  const plausible = checkCreatedAtPlausible(parsed.data.createdAt, now);
  if (!plausible.ok) {
    return { ok: false, message: plausible.message };
  }
  return { ok: true, data: parsed.data };
}
