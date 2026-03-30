import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";

export function useMarketSales(marketId: string) {
  return useQuery<any[]>({
    queryKey: ["/api/markets", marketId, "sales"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/markets/${marketId}/sales`);
      return res.json();
    },
    enabled: !!marketId,
  });
}

export function useAllMarketSales() {
  return useQuery<any[]>({ queryKey: ["/api/market-sales"] });
}

export function useCreateMarketSale() {
  return useMutation({
    mutationFn: async ({
      marketId,
      ...data
    }: {
      marketId: string;
      description: string;
      amount: number;
      quantity: number;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/markets/${marketId}/sales`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-sales"] });
    },
  });
}

export function useDeleteMarketSale() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/market-sales/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/markets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market-sales"] });
    },
  });
}
