import { NextResponse } from "next/server";
import { getStripe } from "@/lib/server/stripe";
import * as storage from "@/lib/server/storage";
import { db } from "@/lib/server/db";
import { users, webhookEvents } from "@/lib/server/schema";
import { eq } from "drizzle-orm";

/**
 * Resolves the subscription's paid-through date from Stripe
 * (`current_period_end`) instead of assuming a fixed +30 days.
 * Falls back to +30 days only if the value can't be read.
 */
async function getSubscriptionExpiry(subscriptionId: string): Promise<Date> {
  try {
    const sub = (await getStripe().subscriptions.retrieve(
      subscriptionId
    )) as unknown as Record<string, unknown>;

    let periodEnd = sub.current_period_end as number | undefined;
    if (!periodEnd) {
      // Newer Stripe API versions expose the period on the subscription item.
      const items = (sub.items as { data?: Array<{ current_period_end?: number }> } | undefined)?.data;
      periodEnd = items?.[0]?.current_period_end;
    }
    if (periodEnd) return new Date(periodEnd * 1000);
  } catch (error) {
    console.error("Failed to read subscription period end:", error);
  }
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 30);
  return fallback;
}

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

    // Idempotency: skip events we've already processed (guards against replays,
    // e.g. a re-delivered customer.subscription.deleted cancelling an active sub).
    const [seen] = await db
      .select({ eventId: webhookEvents.eventId })
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id));
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Use Record type for event data — Stripe v22 types are overly strict
    // for constructEvent which returns generic Stripe.Event
    const obj = event.data.object as unknown as Record<string, unknown>;

    switch (event.type) {
      case "checkout.session.completed": {
        const userId = (obj.metadata as Record<string, string>)?.vendora_user_id;
        const subscriptionId = obj.subscription as string | undefined;

        if (userId && subscriptionId) {
          const expiresAt = await getSubscriptionExpiry(subscriptionId);

          // Idempotent: only update if new expiration is later than current
          const currentUser = await storage.getUser(userId);
          const currentExpiry = currentUser?.subscriptionExpiresAt ? new Date(currentUser.subscriptionExpiresAt) : null;
          if (!currentExpiry || expiresAt > currentExpiry) {
            await storage.updateSubscription(userId, {
              subscriptionStatus: "active",
              subscriptionExpiresAt: expiresAt,
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: obj.customer as string,
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const subscriptionId = obj.subscription as string | undefined;

        if (subscriptionId) {
          const customerId = obj.customer as string;

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.stripeCustomerId, customerId));

          if (user) {
            const expiresAt = await getSubscriptionExpiry(subscriptionId);
            // Idempotent: only extend if new expiration is later than current
            const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
            if (!currentExpiry || expiresAt > currentExpiry) {
              await storage.updateSubscription(user.id, {
                subscriptionStatus: "active",
                subscriptionExpiresAt: expiresAt,
              });
            }
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
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    // Record the event as processed (after successful handling, so a failure
    // above returns 500 and lets Stripe retry).
    await db.insert(webhookEvents).values({ eventId: event.id }).onConflictDoNothing();

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ message: "Webhook error" }, { status: 500 });
  }
}
