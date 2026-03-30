import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import type { Order } from "@/lib/types";

const KEY = ["/api/orders"];

export function useOrders() {
  return useQuery<Order[]>({ queryKey: KEY });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      customerAddress: string;
      status: string;
      notes: string;
      orderDate: string;
      items: { name: string; quantity: number; price: number }[];
    }) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateOrder() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      customerName: string;
      customerEmail: string;
      customerAddress: string;
      status: string;
      notes: string;
      orderDate: string;
      items: { name: string; quantity: number; price: number }[];
    }>) => {
      const res = await apiRequest("PUT", `/api/orders/${id}`, data);
      return res.json() as Promise<Order>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteOrder() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
