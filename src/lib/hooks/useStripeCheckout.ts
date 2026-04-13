import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);

  const redirectToCheckout = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/checkout");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Stripe checkout error:", error);
      setLoading(false);
    }
  };

  return { redirectToCheckout, loading };
}
