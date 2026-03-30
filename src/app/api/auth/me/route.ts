import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const subscription = storage.getSubscriptionStatus(user);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    subscription,
  });
}
