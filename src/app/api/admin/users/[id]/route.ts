import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import * as storage from "@/lib/server/storage";
import { getEffectivePlan } from "@/lib/plan";
import { z } from "zod";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("grant_pro"), days: z.number().int().min(1).max(3650) }),
  z.object({ action: z.literal("revoke_pro") }),
  z.object({ action: z.literal("block") }),
  z.object({ action: z.literal("unblock") }),
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const { id } = await params;
    const user = await storage.getUser(id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      plan: getEffectivePlan(user),
      subscriptionStatus: user.subscriptionStatus,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      isBlocked: user.isBlocked ?? false,
    });
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
    const result = await requireAdmin();
    if (result instanceof NextResponse) return result;

    const { id } = await params;
    const user = await storage.getUser(id);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid action", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const action = parsed.data;

    switch (action.action) {
      case "grant_pro": {
        // Grant PRO for N days from the later of now / current expiry.
        const current = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : new Date();
        const expiresAt = new Date(Math.max(current.getTime(), Date.now()));
        expiresAt.setDate(expiresAt.getDate() + action.days);
        await db.update(users).set({
          plan: "pro",
          subscriptionStatus: "active",
          subscriptionExpiresAt: expiresAt,
        }).where(eq(users.id, id));
        break;
      }

      case "revoke_pro": {
        await db.update(users).set({
          plan: "free",
          subscriptionStatus: "cancelled",
        }).where(eq(users.id, id));
        break;
      }

      case "block": {
        await db.update(users).set({ isBlocked: true }).where(eq(users.id, id));
        break;
      }

      case "unblock": {
        await db.update(users).set({ isBlocked: false }).where(eq(users.id, id));
        break;
      }
    }

    const updated = await storage.getUser(id);

    return NextResponse.json({
      ...updated,
      plan: updated ? getEffectivePlan(updated) : "free",
      message: `Action '${action.action}' completed`,
    });
  } catch (error) {
    console.error("PUT /api/admin/users/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
