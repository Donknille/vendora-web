import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { Invoice } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/invoices"] as const;
}

// Rechnung und Storno tragen Beträge (Storno negativ), die im Dashboard
// erscheinen — die Liste allein zu invalidieren reichte nicht.
function invalidateInvoiceWrites(userId: string | null | undefined) {
  for (const path of ["/api/invoices", "/api/dashboard"]) {
    queryClient.invalidateQueries({ queryKey: [userId, path] });
  }
}

export function useInvoices() {
  const key = useKey();
  return useAppQuery<Invoice[]>([...key]);
}

export function useIssueInvoice() {
  const key = useKey();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", "/api/invoices", { orderId });
      return res.json() as Promise<Invoice>;
    },
    onSuccess: () => {
      invalidateInvoiceWrites(key[0]);
    },
  });
}

export function useCancelInvoice() {
  const key = useKey();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await apiRequest("POST", `/api/invoices/${invoiceId}/cancel`);
      return res.json() as Promise<{ cancellation: Invoice; original: Invoice }>;
    },
    onSuccess: () => {
      invalidateInvoiceWrites(key[0]);
    },
  });
}
