import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { deleteAccount } from "@/lib/server/accountDeletion";

export async function DELETE() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const result = await deleteAccount(userId);

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
      return NextResponse.json(
        { message: "Failed to delete payment data. Please try again or contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Account and all data deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/account error:", error);
    return NextResponse.json({ message: "Failed to delete account" }, { status: 500 });
  }
}
