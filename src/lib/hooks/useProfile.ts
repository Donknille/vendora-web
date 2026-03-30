import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import type { CompanyProfile } from "@/lib/types";

const KEY = ["/api/profile"];

export function useProfile() {
  return useQuery<CompanyProfile>({ queryKey: KEY });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: async (data: {
      name: string;
      address: string;
      email: string;
      phone: string;
      taxNote: string;
      smallBusinessNote?: string;
      defaultShippingCost?: number;
    }) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return res.json() as Promise<CompanyProfile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
