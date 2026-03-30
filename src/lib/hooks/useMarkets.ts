import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import type { MarketEvent } from "@/lib/types";

const KEY = ["/api/markets"];

export function useMarkets() {
  return useQuery<MarketEvent[]>({ queryKey: KEY });
}

export function useCreateMarket() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      date: string;
      location: string;
      standFee: number;
      travelCost: number;
      notes: string;
    }) => {
      const res = await apiRequest("POST", "/api/markets", data);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateMarket() {
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      name: string;
      date: string;
      location: string;
      standFee: number;
      travelCost: number;
      notes: string;
    }>) => {
      const res = await apiRequest("PUT", `/api/markets/${id}`, data);
      return res.json() as Promise<MarketEvent>;
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
