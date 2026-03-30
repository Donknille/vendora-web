import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureUserRecord } from "@/lib/server/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureUserRecord(data.user.id, data.user.email!);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
