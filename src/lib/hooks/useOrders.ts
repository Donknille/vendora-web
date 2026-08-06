import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { Order, Customer } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/orders"] as const;
}

// Creating/editing an order may add or relink a customer master record.
function invalidateOrderScopedQueries(userId: string | null | undefined) {
  queryClient.invalidateQueries({ queryKey: [userId, "/api/orders"] });
  queryClient.invalidateQueries({ queryKey: [userId, "/api/customers"] });
}

export function useOrders() {
  const key = useKey();
  return useAppQuery<Order[]>([...key]);
}

export function useCreateOrder() {
  const key = useKey();
  return useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerStreet: string;
      customerZip: string;
      customerCity: string;
      customerCountry?: string;
      status: string;
      notes: string;
      orderDate: string;
      paidAt?: string;
      paymentMethod?: string;
      shippingCost?: number; // cents
      items: { name: string; quantity: number; price: number }[];
    }) => {
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
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      customerName: string;
      customerEmail: string;
      customerStreet: string;
      customerZip: string;
      customerCity: string;
      customerCountry?: string;
      status: string;
      notes: string;
      orderDate: string;
      paidAt: string;
      paymentMethod: string;
      shippingCost: number; // cents
      items: { name: string; quantity: number; price: number }[];
    }>) => {
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
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}

export function useCustomers() {
  const userId = useCurrentUserId();
  return useAppQuery<Customer[]>([userId, "/api/customers"], {
    staleTime: 10 * 60 * 1000,
  });
}
