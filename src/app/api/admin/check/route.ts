import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { isAdmin } from "@/lib/server/admin";

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ isAdmin: false });
    }

    const admin = await isAdmin(userId);
    return NextResponse.json({ isAdmin: admin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
