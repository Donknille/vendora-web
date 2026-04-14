import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { getStripe } from "@/lib/server/stripe";
import * as storage from "@/lib/server/storage";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await storage.getUser(userId);
    if (!user || !user.stripeCustomerId) {
      return NextResponse.json({ message: "No active subscription found" }, { status: 404 });
    }

    const { origin } = new URL(request.url);

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("POST /api/stripe/portal error:", error);
    return NextResponse.json({ message: "Failed to create portal session" }, { status: 500 });
  }
}
