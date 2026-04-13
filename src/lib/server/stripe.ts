import Stripe from "stripe";

export const STRIPE_PRICE_ID = "price_1TLMvBRuExfV3pRvytt2kAIV";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}
