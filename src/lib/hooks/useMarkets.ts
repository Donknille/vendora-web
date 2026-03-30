import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";

const KEY = ["/api/markets"];

export function useMarkets() {
  return useQuery<any[]>({ queryKey: KEY });
}

export function useCreateMarket() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/markets", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateMarket() {
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PUT", `/api/markets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteMarket() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/markets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
