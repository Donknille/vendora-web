import { NextResponse } from "next/server";
import { fail, withRoute } from "@/lib/server/route";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { listUsers } from "@/lib/server/adminData";

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  plan: z.enum(["free", "trial", "pro"]).optional(),
  status: z.enum(["trial", "active", "expired", "cancelled"]).optional(),
  blocked: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withRoute("GET /api/admin/users", async ({ request }) => {
  const actor = await requireAdmin();
  if (actor instanceof NextResponse) return actor;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return fail(400, "Invalid query", { errors: parsed.error.flatten().fieldErrors });
  }

  const { search, plan, status, blocked, page, pageSize } = parsed.data;

  const result = await listUsers({
    search: search || undefined,
    plan,
    status,
    blocked: blocked === undefined ? undefined : blocked === "true",
    page,
    pageSize,
  });

  return NextResponse.json(result);
});
