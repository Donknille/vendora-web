import "server-only";
import Stripe from "stripe";
import { env } from "./env";

export const STRIPE_PRICE_ID = "price_1TLMf7RvBVbOJnhsnhujvSmR";

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
