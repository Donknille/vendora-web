import { z } from "zod";
import { EUER_CATEGORIES } from "@/lib/euer";

/**
 * Die übrigen Nutzlast-Schemas (Refactoring-Plan 2.2): Ausgaben, Firmenprofil,
 * Rechnungsausstellung. Klein genug, dass eigene Dateien mehr Ordner als
 * Erkenntnis brächten.
 *
 * Nicht hierher gewandert sind die Abfrage-Schemas der Admin-Routen und die
 * Formatprüfung in `/api/migrate`. Die beschreiben keine geteilte Domänenform,
 * sondern den Vertrag genau einer Route — und kein Hook leitet einen Typ
 * daraus ab. Sie zu verschieben hieße, Ordnung mit Verteilung zu verwechseln.
 */

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().int().min(0).max(99999999), // cents
  category: z.enum(EUER_CATEGORIES),
  expenseDate: z.string().min(1, "Date is required").max(50),
});

// Defense-in-depth: reject strings that look like HTML/script injection
const noHtml = (val: string) => !/<script|<\/script|<iframe|<object|<embed|javascript:/i.test(val);

const safeStr = (max: number) =>
  z.string().max(max).refine(noHtml, { message: "HTML tags are not allowed" });

export const updateProfileSchema = z.object({
  name: safeStr(200).default(""),
  address: safeStr(500).default(""),
  email: safeStr(254).default(""),
  phone: safeStr(50).default(""),
  taxNote: safeStr(500).default(""),
  smallBusinessNote: safeStr(500).optional(),
  isSmallBusiness: z.boolean().default(true),
  defaultShippingCost: z.number().int().min(0).max(9999999).optional(), // cents
});

export const issueInvoiceSchema = z.object({
  orderId: z.string().min(1).max(100),
});

export type CreateExpenseInput = z.input<typeof createExpenseSchema>;
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
