import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { Order, Customer } from "@/lib/types";
// Die Nutzlast-Formen kommen aus dem Zod-Schema der Route, nicht aus einer
// zweiten Handabschrift (Refactoring-Plan 2.2). Reiner Typ-Import: im
// Bundle landet davon nichts.
import type { CreateOrderInput, UpdateOrderInput } from "@/lib/schemas/order";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/orders"] as const;
}

// Ein Auftrag berührt mehr als seine Liste: Kundenstamm (Autocomplete),
// Dashboard/EÜR (bezahlte Aufträge sind Einnahmen) und beim Löschen die
// Rechnungen (orderId wird null). Vorher blieb das Dashboard nach dem
// Löschen fünf Minuten lang bei den alten Zahlen.
function invalidateOrderScopedQueries(userId: string | null | undefined) {
  for (const path of ["/api/orders", "/api/customers", "/api/dashboard", "/api/invoices"]) {
    queryClient.invalidateQueries({ queryKey: [userId, path] });
  }
}

export function useOrders() {
  const key = useKey();
  return useAppQuery<Order[]>([...key]);
}

export function useCreateOrder() {
  const key = useKey();
  return useMutation({
    mutationFn: async (data: CreateOrderInput) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      invalidateOrderScopedQueries(key[0]);
    },
  });
}

export function useUpdateOrder() {
  const key = useKey();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & UpdateOrderInput) => {
      const res = await apiRequest("PUT", `/api/orders/${id}`, data);
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      invalidateOrderScopedQueries(key[0]);
    },
  });
}

export function useDeleteOrder() {
  const key = useKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      invalidateOrderScopedQueries(key[0]);
    },
  });
}

export function useCustomers() {
  const userId = useCurrentUserId();
  return useAppQuery<Customer[]>([userId, "/api/customers"], {
    staleTime: 10 * 60 * 1000,
  });
}
