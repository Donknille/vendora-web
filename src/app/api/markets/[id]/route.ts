import { NextResponse } from "next/server";
import { fail, validationError, withAuth } from "@/lib/server/route";
import * as storage from "@/lib/server/storage";
import { requireWriteAccess } from "@/lib/server/limits";
import { z } from "zod";

const quickItemSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().int().min(0).max(99999999), // cents
});

const updateMarketSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  date: z.string().max(50).optional(),
  location: z.string().max(300).optional(),
  standFee: z.number().int().min(0).max(9999999).optional(), // cents
  travelCost: z.number().int().min(0).max(9999999).optional(), // cents
  notes: z.string().max(5000).optional(),
  status: z.enum(["open", "applied", "confirmed", "completed", "cancelled"]).optional(),
  applicationDeadline: z.string().max(50).nullish(),
  quickItems: z.array(quickItemSchema).max(50).optional(),
});

export const PUT = withAuth<{ id: string }>(
  "PUT /api/markets/[id]",
  async ({ userId, request, params }) => {
    const { id } = params;
    const parsed = updateMarketSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);

    // Das PUT ist sonst ein Create-Pfad: updateMarket erzeugt ueber
    // syncMarketExpenses abgeleitete Ausgabenzeilen und schreibt quickItems.
    //
    // Der reine Statuswechsel ist ausgenommen, und zwar zwingend: Standgebuehr
    // und Fahrtkosten werden nur bei "confirmed"/"completed" gebucht, der
    // Wechsel auf "cancelled" ist der EINZIGE Weg, sie wieder loszuwerden
    // (direkt loeschen verweigert /api/expenses mit 409 DERIVED_EXPENSE).
    // Mit Gate haette ein abgelaufenes Konto einen abgesagten Markt dauerhaft
    // als Kosten in der EUeR stehen -- oder muesste den ganzen Markt samt
    // Verkaeufen loeschen.
    // Die Ausnahme wird gegen den BESTAND bestimmt, nicht gegen die Zahl der
    // gesendeten Felder: das Bearbeitungsformular schickt immer den ganzen
    // Datensatz. Eine Pruefung auf "nur ein Schluessel" waere ueber die
    // Oberflaeche nie erreichbar gewesen -- die Ausnahme haette es auf dem
    // Papier gegeben und in der Anwendung nicht.
    const current = await storage.getMarket(userId, id);
    if (!current) return fail(404, "Market not found");
    // Leerwerte normalisieren: ein Markt ohne Schnellartikel steht in der DB als
    // NULL, das Formular sendet aber [] -- ohne diese Angleichung zaehlte das
    // als Aenderung und die Kostenfalle waere zurueck gewesen.
    const norm = (v: unknown) =>
      JSON.stringify(Array.isArray(v) && v.length === 0 ? null : (v ?? null));
    const changedFields = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
      (key) => {
        const next = parsed.data[key];
        if (next === undefined) return false;
        const before = (current as unknown as Record<string, unknown>)[key];
        return norm(next) !== norm(before);
      }
    );
    // Leere Menge = unveraendertes Speichern. Das legt nichts an und wird
    // deshalb nicht gesperrt; sonst liefe ein Klick auf "Speichern" ohne jede
    // Aenderung in eine Pro-Meldung.
    const statusOnly = changedFields.every((key) => key === "status");

    if (!statusOnly) {
      const gate = await requireWriteAccess(userId);
      if (gate) return gate;
    }

    const market = await storage.updateMarket(userId, id, parsed.data);
    if (!market) return fail(404, "Market not found");

    return NextResponse.json(market);
  }
);

export const DELETE = withAuth<{ id: string }>(
  "DELETE /api/markets/[id]",
  async ({ userId, params }) => {
    const deleted = await storage.deleteMarket(userId, params.id);
    if (!deleted) return fail(404, "Market not found");
    return NextResponse.json({ message: "Market deleted" });
  }
);
