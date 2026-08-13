import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import * as storage from "@/lib/server/storage";
import { buildInvoicePdf } from "@/lib/server/invoicePdf";

// Render the invoice PDF on demand from the immutable snapshot — no stored file,
// always byte-identical for the same invoice.
export const GET = withAuth<{ id: string }>(
  "GET /api/invoices/[id]/pdf",
  async ({ userId, params }) => {
    const invoice = await storage.getInvoice(userId, params.id);
    if (!invoice) return fail(404, "Invoice not found");

    const bytes = await buildInvoicePdf(invoice);
    const prefix = invoice.type === "cancellation" ? "Stornorechnung" : "Rechnung";
    const safeNumber = invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_");

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${prefix}_${safeNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  },
  { errorMessage: "PDF generation failed" }
);
