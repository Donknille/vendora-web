import { NextResponse } from "next/server";
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    if (actor instanceof NextResponse) return actor;

    const { id } = await params;
    const user = await getUserDetail(id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/admin/users/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    if (actor instanceof NextResponse) return actor;

    const { id } = await params;

    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid action", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const input = parsed.data;

    if (input.action === "delete_user") {
      const target = await getUserDetail(id);
      if (!target) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
      }
      if (target.email.toLowerCase() !== input.confirmEmail.toLowerCase()) {
        return NextResponse.json(
          { message: "Confirmation email does not match this account" },
          { status: 400 }
        );
      }
    }

    const result = await applyAdminAction(actor, id, input);

    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return NextResponse.json({ message: "User not found" }, { status: 404 });
        case "self_target":
          return NextResponse.json(
            { message: "You cannot block or delete your own admin account" },
            { status: 400 }
          );
        case "stripe_failed":
          return NextResponse.json(
            { message: "Failed to delete payment data. Nothing was changed." },
            { status: 500 }
          );
      }
    }

    return NextResponse.json({ user: result.user, action: input.action });
  } catch (error) {
    console.error("PUT /api/admin/users/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
