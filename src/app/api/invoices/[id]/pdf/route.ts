import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { buildInvoicePdf } from "@/lib/server/invoicePdf";

// Render the invoice PDF on demand from the immutable snapshot — no stored file,
// always byte-identical for the same invoice.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await storage.getInvoice(userId, id);
    if (!invoice) {
      return NextResponse.json({ message: "Invoice not found" }, { status: 404 });
    }

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
  } catch (error) {
    console.error("GET /api/invoices/[id]/pdf error:", error);
    return NextResponse.json({ message: "PDF generation failed" }, { status: 500 });
  }
}
