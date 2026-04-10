import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { isAdmin } from "@/lib/server/admin";
import * as storage from "@/lib/server/storage";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ isAdmin: false, debug: "no userId" });
    }

    const user = await storage.getUser(userId);
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
    const admin = await isAdmin(userId);

    return NextResponse.json({
      isAdmin: admin,
      debug: {
        userId,
        userEmail: user?.email ?? "NOT_FOUND",
        adminEmails,
        envSet: !!process.env.ADMIN_EMAILS,
      },
    });
  } catch (error) {
    return NextResponse.json({ isAdmin: false, debug: String(error) });
  }
}
