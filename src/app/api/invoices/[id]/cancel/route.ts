import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import * as storage from "@/lib/server/storage";

// Issue a cancellation (Storno) invoice for an issued invoice. Corrective and
// legally required, so it is not subscription-gated (only auth + ownership).
export const POST = withAuth<{ id: string }>(
  "POST /api/invoices/[id]/cancel",
  async ({ userId, params }) => {
    const result = await storage.cancelInvoice(userId, params.id);
    if (!result.ok) {
      if (result.code === "not_found") return fail(404, "Invoice not found");
      return fail(409, "This invoice cannot be cancelled", { code: "NOT_CANCELLABLE" });
    }

    return NextResponse.json(result);
  }
);
