import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { AppSettings } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/settings"] as const;
}

export function useAppSettings() {
  const key = useKey();
  return useQuery<AppSettings>({ queryKey: [...key], enabled: !!key[0] });
}

export function useUpdateSettings() {
  const key = useKey();
  return useMutation({
    mutationFn: async (data: { theme: string; currency: string }) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json() as Promise<AppSettings>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}
