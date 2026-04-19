import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureUserRecord } from "@/lib/server/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Auth callback - exchangeCodeForSession error:", error);
        return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
      }

      if (data.user) {
        try {
          const record = await ensureUserRecord(data.user.id, data.user.email!);
          if (!record) {
            // Deleted account attempted re-registration
            return NextResponse.redirect(`${origin}/auth/login?error=account_deleted`);
          }
        } catch (dbError) {
          console.error("Auth callback - ensureUserRecord error:", dbError);
          return NextResponse.redirect(`${origin}/auth/login?error=setup_failed`);
        }
        return NextResponse.redirect(`${origin}/dashboard`);
      }
    } catch (error) {
      console.error("Auth callback - unexpected error:", error);
      return NextResponse.redirect(`${origin}/auth/login?error=callback_failed`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
