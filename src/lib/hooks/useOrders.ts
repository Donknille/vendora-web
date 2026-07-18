import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { Order } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/orders"] as const;
}

export function useOrders() {
  const key = useKey();
  return useQuery<Order[]>({ queryKey: [...key], enabled: !!key[0] });
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
      items: { name: string; quantity: number; price: number }[];
    }) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
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
      items: { name: string; quantity: number; price: number }[];
    }>) => {
      const res = await apiRequest("PUT", `/api/orders/${id}`, data);
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
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
  return useQuery<{
    customerName: string;
    customerEmail: string;
    customerStreet: string;
    customerZip: string;
    customerCity: string;
    customerCountry: string;
  }[]>({ queryKey: [userId, "/api/customers"], staleTime: 10 * 60 * 1000, enabled: !!userId });
}
