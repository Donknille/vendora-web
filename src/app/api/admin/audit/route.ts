import { NextResponse } from "next/server";
import { fail, withRoute } from "@/lib/server/route";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { listAuditLog } from "@/lib/server/adminData";

const querySchema = z.object({
  targetUserId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = withRoute("GET /api/admin/audit", async ({ request }) => {
  const actor = await requireAdmin();
  if (actor instanceof NextResponse) return actor;

  // Bewusst "Invalid query" und nicht validationError(): das ist eine
  // Abfragezeichenkette, kein Formular, und der Wortlaut unterscheidet sich.
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return fail(400, "Invalid query", { errors: parsed.error.flatten().fieldErrors });
  }

  const { targetUserId, page, pageSize } = parsed.data;
  return NextResponse.json(
    await listAuditLog({ targetUserId: targetUserId || undefined, page, pageSize })
  );
});
