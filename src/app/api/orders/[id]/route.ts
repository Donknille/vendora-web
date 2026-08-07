import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { requireWriteAccess } from "@/lib/server/limits";
import { orderTotalWithinBounds } from "../route";
import { z } from "zod";

const updateOrderItemSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().min(1, "Item name is required").max(200),
  quantity: z.number().int().min(1).max(9999),
  price: z.number().int().min(0).max(99999999), // cents
  processingStatus: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

const updateOrderSchema = z.object({
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Ein PUT ist sonst faktisch ein Create-Pfad: updateOrder legt ueber
    // upsertCustomerFromOrder neue Kundenzeilen an und ersetzt saemtliche
    // Positionen. Ohne Gate koennte ein Free-Konto ueber einen einzigen
    // bestehenden Auftrag dauerhaft weiterarbeiten -- "Nur-Lese" waere nur eine
    // Beschriftung. Der reine Statuswechsel bleibt erlaubt (wie beim Markt): er
    // legt nichts an, sondern haelt einen vorhandenen Vorgang aktuell.
    // Wie beim Markt gegen den Bestand bestimmt: das Bearbeitungsformular
    // sendet immer alle Felder, eine Zaehlung der Schluessel ginge daran vorbei.
    const current = await storage.getOrder(userId, id);
    if (!current) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    // Positionen werden inhaltlich verglichen: die gespeicherten Zeilen tragen
    // zusaetzliche Felder (id, orderId), ein roher Vergleich haette jede
    // unveraenderte Liste als Aenderung gewertet.
    const normalizeItems = (items: unknown) =>
      Array.isArray(items)
        ? JSON.stringify(
            items.map((i) => {
              const item = i as Record<string, unknown>;
              return {
                name: item.name,
                quantity: Number(item.quantity),
                price: Number(item.price),
                processingStatus: item.processingStatus ?? null,
                comment: item.comment ?? null,
              };
            })
          )
        : "";

    const changedFields = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
      (key) => {
        const next = parsed.data[key];
        if (next === undefined) return false;
        const before = (current as unknown as Record<string, unknown>)[key];
        if (key === "items") return normalizeItems(next) !== normalizeItems(before);
        // Leerwerte angleichen (null vs "" vs []), sonst zaehlt ein
        // unveraendertes Formularfeld als Aenderung.
        const norm = (v: unknown) =>
          JSON.stringify(Array.isArray(v) && v.length === 0 ? null : (v ?? null));
        return norm(next) !== norm(before);
      }
    );
    // Leere Menge = unveraendertes Speichern; legt nichts an, wird nicht gesperrt.
    const statusOnly = changedFields.every((key) => key === "status");

    if (!statusOnly) {
      const gate = await requireWriteAccess(userId);
      if (gate) return gate;
    }

    const order = await storage.updateOrder(userId, id, parsed.data);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("PUT /api/orders/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await storage.deleteOrder(userId, id);
    if (!deleted) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Order deleted" });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
