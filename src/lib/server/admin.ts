import "server-only";
import { NextResponse } from "next/server";
import { getAuthUserId } from "./auth";
import * as storage from "./storage";
import { env } from "./env";

const getAdminEmails = (): string[] =>
  (env.ADMIN_EMAILS || "")
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

export type AdminActor = { userId: string; email: string };

/**
 * Gate for every admin endpoint. Returns the acting admin's identity (not just
 * their id) because every mutating action has to be attributable in the audit
 * log, and the log stores the email as a snapshot so it survives the account.
 */
export async function requireAdmin(): Promise<AdminActor | NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const user = await storage.getUser(userId);
  if (!user || !adminEmails.includes(user.email.toLowerCase())) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return { userId, email: user.email };
}
