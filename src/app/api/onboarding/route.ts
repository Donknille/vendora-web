import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

// Merker fuer die Willkommens-Erklaerung. Er haengt bewusst am Konto und nicht
// nur an localStorage: sonst erschiene die Erklaerung bei jedem Geraetewechsel,
// geleerten Browserspeicher und jeder Neuinstallation der PWA erneut.
//
// Ohne `requireActiveSubscription`: gerade Free- und Trial-Konten sollen die
// Erklaerung sehen. Kein Request-Body, also nichts zu validieren.

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const onboarded = await storage.hasCompletedOnboarding(userId);
    return NextResponse.json({ onboarded });
  } catch (error) {
    console.error("GET /api/onboarding error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Idempotent (siehe storage.markOnboardingComplete) — ein nachgeholter
    // Versuch nach fehlendem Netz schiebt den Zeitpunkt nicht nach vorn.
    await storage.markOnboardingComplete(userId);
    return NextResponse.json({ onboarded: true });
  } catch (error) {
    console.error("POST /api/onboarding error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
