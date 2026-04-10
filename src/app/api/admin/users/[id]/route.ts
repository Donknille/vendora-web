import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend_trial"), days: z.number().int().min(1).max(365) }),
  z.object({ action: z.literal("activate_subscription"), expiresAt: z.string() }),
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

    const subscription = storage.getSubscriptionStatus(user);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      subscriptionStatus: user.subscriptionStatus,
      trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      isBlocked: user.isBlocked ?? false,
      subscription,
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
      case "extend_trial": {
        const currentEnd = user.trialEndsAt ? new Date(user.trialEndsAt) : new Date();
        const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
        newEnd.setDate(newEnd.getDate() + action.days);
        await db.update(users).set({
          subscriptionStatus: "trial",
          trialEndsAt: newEnd,
        }).where(eq(users.id, id));
        break;
      }

      case "activate_subscription": {
        const expiresAt = new Date(action.expiresAt);
        await db.update(users).set({
          subscriptionStatus: "active",
          subscriptionExpiresAt: expiresAt,
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
    const subscription = storage.getSubscriptionStatus(updated!);

    return NextResponse.json({
      ...updated,
      subscription,
      message: `Action '${action.action}' completed`,
    });
  } catch (error) {
    console.error("PUT /api/admin/users/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
