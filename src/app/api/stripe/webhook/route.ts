import { NextResponse } from "next/server";
import { getStripe } from "@/lib/server/stripe";
import * as storage from "@/lib/server/storage";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ message: "Missing signature" }, { status: 400 });
    }

    // Fail-closed: reject all events if webhook secret is not configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook");
      return NextResponse.json({ message: "Webhook not configured" }, { status: 500 });
    }

    let event;
    try {
      event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
    } catch {
      console.error("Webhook signature verification failed");
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
    }

    // Use Record type for event data — Stripe v22 types are overly strict
    // for constructEvent which returns generic Stripe.Event
    const obj = event.data.object as unknown as Record<string, unknown>;

    switch (event.type) {
      case "checkout.session.completed": {
        const userId = (obj.metadata as Record<string, string>)?.vendora_user_id;
        const subscriptionId = obj.subscription as string | undefined;

        if (userId && subscriptionId) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await storage.updateSubscription(userId, {
            subscriptionStatus: "active",
            subscriptionExpiresAt: expiresAt,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: obj.customer as string,
          });

          console.log(`[STRIPE] Subscription activated for user ${userId}, expires ${expiresAt.toISOString()}`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const subscriptionId = obj.subscription as string | undefined;

        if (subscriptionId) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          const customerId = obj.customer as string;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId));

          if (user) {
            await storage.updateSubscription(user.id, {
              subscriptionStatus: "active",
              subscriptionExpiresAt: expiresAt,
            });
            console.log(`[STRIPE] Subscription renewed for user ${user.id}, expires ${expiresAt.toISOString()}`);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = obj.customer as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, customerId));

        if (user) {
          await storage.updateSubscription(user.id, {
            subscriptionStatus: "cancelled",
          });
          console.log(`[STRIPE] Subscription cancelled for user ${user.id}`);
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ message: "Webhook error" }, { status: 500 });
  }
}
