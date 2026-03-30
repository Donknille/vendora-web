import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/api-client";
import type { SubscriptionInfo } from "@/lib/types";

export type { SubscriptionInfo };

export function useSubscription() {
  return useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    staleTime: 60_000,
  });
}

export function invalidateSubscription() {
  queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
}
