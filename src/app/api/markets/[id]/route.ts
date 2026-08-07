import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
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
    const parsed = updateMarketSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

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
    const statusOnly =
      Object.keys(parsed.data).length === 1 && parsed.data.status !== undefined;
    if (!statusOnly) {
      const gate = await requireWriteAccess(userId);
      if (gate) return gate;
    }

    const market = await storage.updateMarket(userId, id, parsed.data);
    if (!market) {
      return NextResponse.json({ message: "Market not found" }, { status: 404 });
    }

    return NextResponse.json(market);
  } catch (error) {
    console.error("PUT /api/markets/[id] error:", error);
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
    const deleted = await storage.deleteMarket(userId, id);
    if (!deleted) {
      return NextResponse.json({ message: "Market not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Market deleted" });
  } catch (error) {
    console.error("DELETE /api/markets/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
