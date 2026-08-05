import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { listAuditLog } from "@/lib/server/adminData";

const querySchema = z.object({
  targetUserId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    const actor = await requireAdmin();
    if (actor instanceof NextResponse) return actor;

    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = querySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid query", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { targetUserId, page, pageSize } = parsed.data;
    return NextResponse.json(
      await listAuditLog({ targetUserId: targetUserId || undefined, page, pageSize })
    );
  } catch (error) {
    console.error("GET /api/admin/audit error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
