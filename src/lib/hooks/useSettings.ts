import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";

const KEY = ["/api/settings"];

export function useAppSettings() {
  return useQuery<any>({ queryKey: KEY });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
