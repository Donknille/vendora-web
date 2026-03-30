import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import type { AppSettings } from "@/lib/types";

const KEY = ["/api/settings"];

export function useAppSettings() {
  return useQuery<AppSettings>({ queryKey: KEY });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: async (data: { theme: string; currency: string }) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json() as Promise<AppSettings>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
