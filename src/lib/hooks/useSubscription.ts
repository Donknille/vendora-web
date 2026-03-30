import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/api-client";

export interface SubscriptionInfo {
  status: "trial" | "active" | "expired" | "cancelled";
  isActive: boolean;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  daysRemaining: number | null;
}

export function useSubscription() {
  return useQuery<SubscriptionInfo>({
    queryKey: ["/api/subscription"],
    staleTime: 60_000,
  });
}

export function invalidateSubscription() {
  queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
}
