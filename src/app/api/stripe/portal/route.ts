import { NextResponse } from "next/server";
import { fail, withAuth } from "@/lib/server/route";
import { getStripe } from "@/lib/server/stripe";
import * as storage from "@/lib/server/storage";

export const POST = withAuth(
  "POST /api/stripe/portal",
  async ({ userId, request }) => {
    const user = await storage.getUser(userId);
    if (!user || !user.stripeCustomerId) {
      return fail(404, "No active subscription found");
    }

    const { origin } = new URL(request.url);

    const session = await getStripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  },
  { errorMessage: "Failed to create portal session" }
);
