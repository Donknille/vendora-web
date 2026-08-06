import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

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
    // Kein requireWriteAccess: das Gate in lib/server/limits.ts ist bewusst
    // create-only — ein abgelaufenes Konto muss seine Daten loeschen koennen.
    const result = await storage.deleteExpense(userId, id);
    if (result === "not_found") {
      return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    }
    if (result === "derived") {
      return NextResponse.json(
        {
          message: "Marktkosten werden über den Markt gepflegt.",
          code: "DERIVED_EXPENSE",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "Expense deleted" });
  } catch (error) {
    console.error("DELETE /api/expenses/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
