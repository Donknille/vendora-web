import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";

const KEY = ["/api/profile"];

export function useProfile() {
  return useQuery<any>({ queryKey: KEY });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
