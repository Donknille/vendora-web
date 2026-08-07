import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  // Ohne diesen Zustand blieb ein fehlgeschlagener Checkout unsichtbar: der
  // Button flackerte und stand wieder da. Das betrifft auch den Fall
  // ALREADY_PRO (409), bei dem die Nutzerin wissen muss, dass ihr Abo laeuft.
  const [error, setError] = useState("");

  const redirectToCheckout = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("POST", "/api/stripe/checkout");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("");
      setLoading(false);
    } catch (e) {
      console.error("Stripe checkout error:", e);
      setError(e instanceof Error ? e.message : "");
      setLoading(false);
    }
  };

  return { redirectToCheckout, loading, error };
}
