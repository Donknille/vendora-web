import { NextResponse } from "next/server";
import { fail, validationError, withAuth } from "@/lib/server/route";
import { updateMarketSchema } from "@/lib/schemas/market";
import * as storage from "@/lib/server/storage";
import { requireWriteAccess } from "@/lib/server/limits";
import { changedFields, isStatusOnlyChange } from "@/lib/server/changeDetection";

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
    // Leerwerte werden angeglichen (ein Markt ohne Schnellartikel steht in der
    // DB als NULL, das Formular sendet []) — siehe changeDetection.ts.
    const changed = changedFields(parsed.data, current as unknown as Record<string, unknown>);

    if (!isStatusOnlyChange(changed)) {
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
