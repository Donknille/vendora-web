import { z } from "zod";

/**
 * Nutzlast-Schemas für Aufträge.
 *
 * Sie lagen bis Refactoring-Plan 2.2 in den Route-Dateien — mit der Folge, dass
 * `orders/[id]/route.ts` seinen Nachbarn `orders/route.ts` importierte, um an
 * `orderTotalWithinBounds` zu kommen. Eine Route, die eine andere Route
 * importiert, zieht deren gesamten Modulgraphen mit; die gemeinsame Regel
 * gehört keiner der beiden, sondern der Domäne.
 *
 * Diese Datei ist zugleich die einzige Quelle der Nutzlast-Typen: die
 * React-Query-Hooks leiten sie per `z.infer` ab, statt sie ein zweites Mal von
 * Hand zu schreiben. Vorher stand jede Form dreimal da — als Zod-Schema, als
 * Inline-Typ im Hook und als Parametertyp in `storage.ts` — und nichts hielt
 * die drei synchron.
 */

const orderItemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number().int().min(1).max(9999),
  price: z.number().int().min(0).max(99999999), // cents
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

const updateOrderItemSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number().int().min(1).max(9999),
  price: z.number().int().min(0).max(99999999), // cents
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

// orders.total ist integer (max 2.147.483.647 Cent). Ohne diese Pruefung
// scheitert eine ueberlaufende Summe erst in Postgres und landet im
// generischen catch: die Nutzerin sieht ein 500 statt einer Feldmeldung.
export const MAX_ORDER_TOTAL_CENTS = 2_000_000_000;

export function orderTotalWithinBounds(data: {
  items?: { quantity: number; price: number }[];
  shippingCost?: number;
}): boolean {
  const items = (data.items ?? []).reduce((sum, i) => sum + i.quantity * i.price, 0);
  return items + (data.shippingCost ?? 0) <= MAX_ORDER_TOTAL_CENTS;
}

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required").max(200),
  customerEmail: z.string().max(254).default(""),
  customerStreet: z.string().min(1, "Street is required").max(200),
  customerZip: z.string().min(1, "ZIP is required").max(20),
  customerCity: z.string().min(1, "City is required").max(100),
  customerCountry: z.string().max(100).default(""),
  status: z.string().max(50).default("open"),
  notes: z.string().max(5000).default(""),
  orderDate: z.string().min(1, "Order date is required").max(50),
  serviceDate: z.string().max(50).optional(),
  paidAt: z.string().max(50).optional(),
  paymentMethod: z.enum(["cash", "card", "transfer", "paypal", "other"]).optional(),
  shippingCost: z.number().int().min(0).max(9999999).optional(), // cents
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required").max(100),
}).superRefine((data, ctx) => {
  if (!orderTotalWithinBounds(data)) {
    ctx.addIssue({
      code: "custom",
      path: ["items"],
      message: "Die Auftragssumme ist zu gross.",
    });
  }
});

export const updateOrderSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  customerEmail: z.string().max(254).optional(),
  customerStreet: z.string().max(200).optional(),
  customerZip: z.string().max(20).optional(),
  customerCity: z.string().max(100).optional(),
  customerCountry: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  orderDate: z.string().max(50).optional(),
  serviceDate: z.string().max(50).optional(),
  paidAt: z.string().max(50).optional(),
  paymentMethod: z.enum(["cash", "card", "transfer", "paypal", "other"]).optional(),
  shippingCost: z.number().int().min(0).max(9999999).optional(), // cents
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
  items: z.array(updateOrderItemSchema).max(100).optional(),
}).superRefine((data, ctx) => {
  if (!orderTotalWithinBounds(data)) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "Die Auftragssumme ist zu gross." });
  }
});

/** Was `POST /api/orders` entgegennimmt — vor den Zod-Vorbelegungen. */
export type CreateOrderInput = z.input<typeof createOrderSchema>;

/** Was `PUT /api/orders/[id]` entgegennimmt. */
export type UpdateOrderInput = z.input<typeof updateOrderSchema>;
