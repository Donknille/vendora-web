import { z } from "zod";

/**
 * Nutzlast-Schemas für Märkte und Marktverkäufe (Refactoring-Plan 2.2).
 *
 * `quickItemSchema` stand wortgleich in `markets/route.ts` und in
 * `markets/[id]/route.ts` — zwei Kopien derselben Regel, die beim nächsten
 * Feld auseinanderlaufen.
 */

export const quickItemSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().min(0).max(99999999), // cents
});

export const marketStatusEnum = z.enum([
  "open",
  "applied",
  "confirmed",
  "completed",
  "cancelled",
]);

export const createMarketSchema = z.object({
  name: z.string().min(1, "Market name is required").max(200),
  date: z.string().min(1, "Date is required").max(50),
  location: z.string().max(300).default(""),
  standFee: z.number().int().min(0).max(9999999).default(0), // cents
  travelCost: z.number().int().min(0).max(9999999).default(0), // cents
  notes: z.string().max(5000).default(""),
  status: marketStatusEnum.optional(),
  applicationDeadline: z.string().min(1).max(50).nullish(),
  quickItems: z.array(quickItemSchema).max(50).optional(),
});

export const updateMarketSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  date: z.string().max(50).optional(),
  location: z.string().max(300).optional(),
  standFee: z.number().int().min(0).max(9999999).optional(), // cents
  travelCost: z.number().int().min(0).max(9999999).optional(), // cents
  notes: z.string().max(5000).optional(),
  status: marketStatusEnum.optional(),
  applicationDeadline: z.string().max(50).nullish(),
  quickItems: z.array(quickItemSchema).max(50).optional(),
});

export const createMarketSaleSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().int().min(0).max(99999999), // cents
  quantity: z.number().int().min(1).max(9999).default(1),
});

export const MAX_BATCH = 100;

// One queued offline sale. `clientId` is a client-generated UUID used as the
// idempotency key so a sale synced more than once is stored exactly once.
export const batchSaleEntrySchema = z.object({
  clientId: z.string().uuid(),
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().int().min(0).max(99999999), // cents
  quantity: z.number().int().min(1).max(9999).default(1),
  paymentMethod: z.enum(["cash", "card"]).nullish(),
  createdAt: z.string().datetime().optional(),
});

export const batchSalesSchema = z.array(z.unknown()).min(1).max(MAX_BATCH);

export type CreateMarketInput = z.input<typeof createMarketSchema>;
export type UpdateMarketInput = z.input<typeof updateMarketSchema>;
export type CreateMarketSaleInput = z.input<typeof createMarketSaleSchema>;
