import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { SubscriptionInfo } from "@/lib/types";

export type { SubscriptionInfo };

export function useSubscription() {
  const userId = useCurrentUserId();
  return useQuery<SubscriptionInfo>({
    queryKey: [userId, "/api/subscription"],
    staleTime: 60_000,
    enabled: !!userId,
  });
}

export function invalidateSubscription() {
  queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
}
