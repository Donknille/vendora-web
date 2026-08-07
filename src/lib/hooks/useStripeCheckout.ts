import { useState } from "react";
import { apiRequest } from "@/lib/api-client";

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  // Ohne diesen Zustand blieb ein fehlgeschlagener Checkout unsichtbar: der
  // Button flackerte und stand wieder da. Das betrifft auch den Fall
  // ALREADY_PRO (409), bei dem die Nutzerin wissen muss, dass ihr Abo laeuft.
  const [error, setError] = useState<unknown>(null);

  const redirectToCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/stripe/checkout");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setLoading(false);
    } catch (e) {
      console.error("Stripe checkout error:", e);
      // Der Fehler wandert roh weiter; uebersetzt wird er in der Oberflaeche
      // ueber seinen Code (apiErrorMessage), nicht ueber seinen Text.
      setError(e);
      setLoading(false);
    }
  };

  return { redirectToCheckout, loading, error };
}
