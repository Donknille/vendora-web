import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { MarketEvent } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/markets"] as const;
}

export function useMarkets() {
  const key = useKey();
  return useQuery<MarketEvent[]>({ queryKey: [...key], enabled: !!key[0] });
}

export function useCreateMarket() {
  const key = useKey();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      date: string;
      location: string;
      standFee: number;
      travelCost: number;
      notes: string;
      quickItems?: { name: string; price: number }[];
    }) => {
      const res = await apiRequest("POST", "/api/markets", data);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}

export function useUpdateMarket() {
  const key = useKey();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      name: string;
      date: string;
      location: string;
      standFee: number;
      travelCost: number;
      notes: string;
      quickItems: { name: string; price: number }[];
    }>) => {
      const res = await apiRequest("PUT", `/api/markets/${id}`, data);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}

export function useDeleteMarket() {
  const key = useKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/markets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}

export function useCopyMarket() {
  const key = useKey();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/markets/${id}/copy`);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}
