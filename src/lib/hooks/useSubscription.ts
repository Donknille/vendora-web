import { queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { SubscriptionInfo } from "@/lib/types";

export type { SubscriptionInfo };

export function useSubscription() {
  const userId = useCurrentUserId();
  return useAppQuery<SubscriptionInfo>([userId, "/api/subscription"], {
    staleTime: 60_000,
  });
}

export function invalidateSubscription() {
  queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
}

/**
 * Whether the current user may create new records. FREE accounts are read-only
 * (Phase 4.2). Optimistic while the plan is still loading — the server enforces
 * the gate regardless.
 */
export function useCanCreate(): boolean {
  const { data } = useSubscription();
  return data ? data.canCreate : true;
}
