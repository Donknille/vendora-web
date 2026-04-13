import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { getStripe, STRIPE_PRICE_ID } from "@/lib/server/stripe";
import * as storage from "@/lib/server/storage";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const { origin } = new URL(request.url);

    // Check if user already has a Stripe customer ID
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      // Create a new Stripe customer
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { vendora_user_id: userId },
      });
      customerId = customer.id;

      // Save Stripe customer ID to our DB
      await storage.updateSubscription(userId, {
        stripeCustomerId: customerId,
      });
    }

    // Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${origin}/settings?subscription=success`,
      cancel_url: `${origin}/settings?subscription=cancelled`,
      metadata: {
        vendora_user_id: userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("POST /api/stripe/checkout error:", error);
    return NextResponse.json({ message: "Failed to create checkout session" }, { status: 500 });
  }
}
