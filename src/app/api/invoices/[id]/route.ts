import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { fail, withAuth } from "@/lib/server/route";

export const GET = withAuth<{ id: string }>(
  "GET /api/invoices/[id]",
  async ({ userId, params }) => {
    const invoice = await storage.getInvoice(userId, params.id);
    if (!invoice) return fail(404, "Invoice not found");
    return NextResponse.json(invoice);
  }
);
