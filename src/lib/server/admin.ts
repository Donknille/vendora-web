import { NextResponse } from "next/server";
import { getAuthUserId } from "./auth";
import * as storage from "./storage";

const getAdminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function isAdmin(userId: string): Promise<boolean> {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return false;

  const user = await storage.getUser(userId);
  if (!user) return false;

  return adminEmails.includes(user.email.toLowerCase());
}

export async function requireAdmin(): Promise<
  { userId: string } | NextResponse
> {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdmin(userId))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return { userId };
}
