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

    let event;

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      try {
        event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
      } catch {
        console.error("Webhook signature verification failed");
        return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
      }
    } else {
      // In development, accept without verification
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.vendora_user_id;
        const subscriptionId = session.subscription;

        if (userId && subscriptionId) {
          // Get subscription details from Stripe
          // Set subscription active for 30 days (Stripe manages actual period)
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);

          await storage.updateSubscription(userId, {
            subscriptionStatus: "active",
            subscriptionExpiresAt: expiresAt,
            stripeSubscriptionId: subscriptionId as string,
            stripeCustomerId: session.customer as string,
          });

          console.log(`[STRIPE] Subscription activated for user ${userId}, expires ${expiresAt.toISOString()}`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        // Recurring payment — extend subscription
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          const customerId = invoice.customer as string;

          // Find user by Stripe customer ID
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
        // Subscription cancelled
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

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
