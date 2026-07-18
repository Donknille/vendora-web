import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import type { CompanyProfile } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/profile"] as const;
}

export function useProfile() {
  const key = useKey();
  return useQuery<CompanyProfile>({ queryKey: [...key], enabled: !!key[0] });
}

export function useUpdateProfile() {
  const key = useKey();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      address: string;
      email: string;
      phone: string;
      taxNote: string;
      smallBusinessNote?: string;
      isSmallBusiness?: boolean;
      defaultShippingCost?: number;
    }) => {
      const res = await apiRequest("PUT", "/api/profile", data);
      return res.json() as Promise<CompanyProfile>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}
