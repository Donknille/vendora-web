import "server-only";
import Stripe from "stripe";
import { env } from "./env";

// Stripe Price ID for the Vendora Pro subscription (19.90 €/month). Configured
// per environment (the price amount lives in the Stripe product); empty when
// billing is not set up locally — the checkout route fails clearly in that case.
export const STRIPE_PRICE_ID = env.STRIPE_PRICE_ID ?? "";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}
