import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";

const KEY = ["/api/orders"];

export function useOrders() {
  return useQuery<any[]>({ queryKey: KEY });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/orders", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateOrder() {
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PUT", `/api/orders/${id}`, data);
      return res.json();
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
