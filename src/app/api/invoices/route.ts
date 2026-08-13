import { NextResponse } from "next/server";
import { fail, validationError, withAuth } from "@/lib/server/route";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { parsePagination } from "@/lib/server/pagination";
import { z } from "zod";

const issueInvoiceSchema = z.object({
  orderId: z.string().min(1).max(100),
});

export const GET = withAuth("GET /api/invoices", async ({ userId, request }) => {
  const data = await storage.getInvoices(userId, parsePagination(request));
  return NextResponse.json(data);
});

export const POST = withAuth("POST /api/invoices", async ({ userId, request }) => {
  // Issuing an invoice creates a new record → requires PRO (FREE is read-only).
  const gate = await requireWriteAccess(userId);
  if (gate) return gate;

  const parsed = issueInvoiceSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const result = await storage.issueInvoice(userId, parsed.data.orderId);
  if (!result.ok) {
    if (result.code === "order_not_found") return fail(404, "Order not found");
    if (result.code === "profile_incomplete") {
      // § 14 Abs. 4 UStG: ohne Name und Anschrift des Ausstellers keine Rechnung.
      return fail(409, "Firmenname und Anschrift fehlen im Firmenprofil.", {
        code: "PROFILE_INCOMPLETE",
      });
    }
    return fail(409, "An active invoice already exists for this order", {
      code: "ALREADY_ISSUED",
    });
  }

  return NextResponse.json(result.invoice, { status: 201 });
});
