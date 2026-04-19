import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { MarketSale } from "@/lib/types";

export function useMarketSales(marketId: string) {
  const userId = useCurrentUserId();
  return useQuery<MarketSale[]>({
    queryKey: [userId, "/api/markets", marketId, "sales"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/markets/${marketId}/sales`);
      return res.json();
    },
    enabled: !!marketId && !!userId,
  });
}

export function useAllMarketSales() {
  const userId = useCurrentUserId();
  return useQuery<MarketSale[]>({ queryKey: [userId, "/api/market-sales"], enabled: !!userId });
}

export function useCreateMarketSale() {
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: async ({ marketId, ...data }: {
      marketId: string;
      description: string;
      amount: number;
      quantity: number;
    }) => {
      const res = await apiRequest("POST", `/api/markets/${marketId}/sales`, data);
      return res.json() as Promise<MarketSale>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [userId, "/api/markets"] });
      queryClient.invalidateQueries({ queryKey: [userId, "/api/market-sales"] });
    },
  });
}

export function useDeleteMarketSale() {
  const userId = useCurrentUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/market-sales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [userId, "/api/markets"] });
      queryClient.invalidateQueries({ queryKey: [userId, "/api/market-sales"] });
    },
  });
}
