import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { withAuth } from "@/lib/server/route";

// Merker fuer die Willkommens-Erklaerung. Er haengt bewusst am Konto und nicht
// nur an localStorage: sonst erschiene die Erklaerung bei jedem Geraetewechsel,
// geleerten Browserspeicher und jeder Neuinstallation der PWA erneut.
//
// Ohne `requireActiveSubscription`: gerade Free- und Trial-Konten sollen die
// Erklaerung sehen. Kein Request-Body, also nichts zu validieren.

export const GET = withAuth("GET /api/onboarding", async ({ userId }) => {
  const onboarded = await storage.hasCompletedOnboarding(userId);
  return NextResponse.json({ onboarded });
});

export const POST = withAuth("POST /api/onboarding", async ({ userId }) => {
  // Idempotent (siehe storage.markOnboardingComplete) — ein nachgeholter
  // Versuch nach fehlendem Netz schiebt den Zeitpunkt nicht nach vorn.
  await storage.markOnboardingComplete(userId);
  return NextResponse.json({ onboarded: true });
});
