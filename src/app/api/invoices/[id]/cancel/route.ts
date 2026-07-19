import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

// Issue a cancellation (Storno) invoice for an issued invoice. Corrective and
// legally required, so it is not subscription-gated (only auth + ownership).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await storage.cancelInvoice(userId, id);
    if (!result.ok) {
      if (result.code === "not_found") {
        return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
      }
      return NextResponse.json(
        { message: "This invoice cannot be cancelled", code: "NOT_CANCELLABLE" },
        { status: 409 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/invoices/[id]/cancel error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
