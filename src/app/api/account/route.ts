import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import { deleteAccount } from "@/lib/server/accountDeletion";

export const DELETE = withAuth(
  "DELETE /api/account",
  async ({ userId }) => {
    const result = await deleteAccount(userId);

    if (!result.ok) {
      if (result.reason === "not_found") return fail(404, "User not found");
      return fail(
        500,
        "Failed to delete payment data. Please try again or contact support."
      );
    }

    return NextResponse.json({ message: "Account and all data deleted successfully" });
  },
  // Abweichender 500-Wortlaut, siehe RouteOptions: eine gescheiterte
  // Kontoloeschung ist fuer die Nutzerin etwas anderes als ein allgemeiner
  // Serverfehler.
  { errorMessage: "Failed to delete account" }
);
