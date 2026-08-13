import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import { getStripe, STRIPE_PRICE_ID } from "@/lib/server/stripe";
import * as storage from "@/lib/server/storage";
import { getEffectivePlan } from "@/lib/plan";

export const POST = withAuth(
  "POST /api/stripe/checkout",
  async ({ userId, request }) => {
  const user = await storage.getUser(userId);
  if (!user) {
    return fail(404, "User not found");
  }

  if (!STRIPE_PRICE_ID) {
    console.error("STRIPE_PRICE_ID is not configured");
    return fail(500, "Billing is not configured");
  }

  // Kein zweites Abo auf denselben Customer. Nach der Rueckkehr aus Stripe
  // ist der Webhook oft noch nicht verarbeitet, die Oberflaeche zeigt also
  // weiter "Pro holen" -- ein zweiter Klick hat bisher ein zweites Abo
  // angelegt und doppelt abgerechnet.
  //
  // Das eigene plan-Feld allein genuegt dafuer NICHT: genau im beschriebenen
  // Rennen steht dort noch "free". Massgeblich ist Stripe selbst, deshalb
  // wird unten zusaetzlich am Customer nachgesehen.
  if (getEffectivePlan(user) === "pro") {
    return NextResponse.json(
      { message: "Dieses Konto hat bereits ein aktives Abo.", code: "ALREADY_PRO" },
      { status: 409 },
    );
  }

  const { origin } = new URL(request.url);

  // Check if user already has a Stripe customer ID
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    // Create a new Stripe customer (idempotency key prevents duplicates on parallel requests)
    const customer = await getStripe().customers.create(
      {
        email: user.email,
        metadata: { vendora_user_id: userId },
      },
      { idempotencyKey: `customer-create-${userId}` },
    );
    customerId = customer.id;

    // Save Stripe customer ID to our DB
    await storage.updateSubscription(userId, {
      stripeCustomerId: customerId,
    });
  } else {
    // Bestandskunde: bei Stripe nachsehen, nicht im eigenen Plan-Feld. Genau
    // waehrend der Webhook noch laeuft, steht dort naemlich weiterhin "free"
    // -- ein zweiter Klick haette dann ein zweites Abo auf denselben Customer
    // gelegt und doppelt abgerechnet.
    const existing = await getStripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    // Bewusst NUR active/trialing. past_due und unpaid bedeuten, dass die
    // Zahlung haengt -- dann steht das Konto ohnehin auf Nur-Lese, und der
    // Checkout ist der einzige Weg zurueck. Wer die Karte erneuern will,
    // darf hier nicht mit "hat schon ein Abo" abgewiesen werden.
    const active = existing.data.find((s) =>
      ["active", "trialing"].includes(s.status),
    );
    if (active) {
      return NextResponse.json(
        { message: "Dieses Konto hat bereits ein aktives Abo.", code: "ALREADY_PRO" },
        { status: 409 },
      );
    }
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
  },
  { errorMessage: "Failed to create checkout session" }
);
