import { NextResponse } from "next/server";
import { fail, withRoute } from "@/lib/server/route";
import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { applyAdminAction, getUserDetail } from "@/lib/server/adminData";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant_pro"), days: z.number().int().min(1).max(3650) }),
  z.object({ action: z.literal("revoke_pro") }),
  z.object({ action: z.literal("extend_trial"), days: z.number().int().min(1).max(365) }),
  z.object({ action: z.literal("block") }),
  z.object({ action: z.literal("unblock") }),
  // Irreversible, so the client has to name the account it means. The server
  // compares it with the stored email and refuses on a mismatch — a mistyped
  // or stale id can then not delete the wrong person's account.
  z.object({ action: z.literal("delete_user"), confirmEmail: z.string().email() }),
]);

export const GET = withRoute<{ id: string }>(
  "GET /api/admin/users/[id]",
  async ({ params }) => {
    const actor = await requireAdmin();
    if (actor instanceof NextResponse) return actor;

    const user = await getUserDetail(params.id);
    if (!user) return fail(404, "User not found");

    return NextResponse.json(user);
  }
);

export const PUT = withRoute<{ id: string }>(
  "PUT /api/admin/users/[id]",
  async ({ request, params }) => {
    const actor = await requireAdmin();
    if (actor instanceof NextResponse) return actor;

    const { id } = params;

    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return fail(400, "Invalid action", { errors: parsed.error.flatten().fieldErrors });
    }
    const input = parsed.data;

    if (input.action === "delete_user") {
      const target = await getUserDetail(id);
      if (!target) return fail(404, "User not found");
      if (target.email.toLowerCase() !== input.confirmEmail.toLowerCase()) {
        return fail(400, "Confirmation email does not match this account");
      }
    }

    const result = await applyAdminAction(actor, id, input);

    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return fail(404, "User not found");
        case "self_target":
          return fail(400, "You cannot block or delete your own admin account");
        case "stripe_failed":
          return fail(500, "Failed to delete payment data. Nothing was changed.");
      }
    }

    return NextResponse.json({ user: result.user, action: input.action });
  }
);
