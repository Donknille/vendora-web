import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { fail, withAuth } from "@/lib/server/route";

export const DELETE = withAuth<{ id: string }>(
  "DELETE /api/expenses/[id]",
  async ({ userId, params }) => {
    // Kein requireWriteAccess: das Gate in lib/server/limits.ts ist bewusst
    // create-only — ein abgelaufenes Konto muss seine Daten loeschen koennen.
    const result = await storage.deleteExpense(userId, params.id);
    if (result === "not_found") return fail(404, "Expense not found");
    if (result === "derived") {
      return fail(409, "Marktkosten werden über den Markt gepflegt.", {
        code: "DERIVED_EXPENSE",
      });
    }
    return NextResponse.json({ message: "Expense deleted" });
  }
);
