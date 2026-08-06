import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { MarketEvent } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/markets"] as const;
}

/**
 * A market write also moves money: its stand fee and travel cost are kept as
 * derived expense rows, and the status gate creates or removes them. Without
 * these keys the expenses list and the dashboard keep showing the old figures.
 */
function useInvalidateMarketWrites() {
  const userId = useCurrentUserId();
  return () => {
    for (const path of ["/api/markets", "/api/expenses", "/api/dashboard"]) {
      queryClient.invalidateQueries({ queryKey: [userId, path] });
    }
  };
}

export function useMarkets() {
  const key = useKey();
  return useAppQuery<MarketEvent[]>([...key]);
}

export function useCreateMarket() {
  const invalidate = useInvalidateMarketWrites();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      date: string;
      location: string;
      standFee: number;
      travelCost: number;
      notes: string;
      status?: string;
      applicationDeadline?: string | null;
      quickItems?: { name: string; price: number }[];
    }) => {
      const res = await apiRequest("POST", "/api/markets", data);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateMarket() {
  const invalidate = useInvalidateMarketWrites();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<{
      name: string;
      date: string;
      location: string;
      standFee: number;
      travelCost: number;
      notes: string;
      status: string;
      applicationDeadline: string | null;
      quickItems: { name: string; price: number }[];
    }>) => {
      const res = await apiRequest("PUT", `/api/markets/${id}`, data);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteMarket() {
  const invalidate = useInvalidateMarketWrites();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/markets/${id}`);
    },
    onSuccess: invalidate,
  });
}

export function useCopyMarket() {
  const invalidate = useInvalidateMarketWrites();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/markets/${id}/copy`);
      return res.json() as Promise<MarketEvent>;
    },
    onSuccess: invalidate,
  });
}
