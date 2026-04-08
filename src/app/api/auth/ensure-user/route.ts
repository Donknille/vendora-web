import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserRecord } from "@/lib/server/auth";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await ensureUserRecord(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/ensure-user error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
