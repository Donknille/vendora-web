import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { Invoice } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/invoices"] as const;
}

export function useInvoices() {
  const key = useKey();
  return useQuery<Invoice[]>({ queryKey: [...key], enabled: !!key[0] });
}

export function useIssueInvoice() {
  const key = useKey();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", "/api/invoices", { orderId });
      return res.json() as Promise<Invoice>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
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
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}
