import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";

const KEY = ["/api/expenses"];

export function useExpenses() {
  return useQuery<any[]>({ queryKey: KEY });
}

export function useCreateExpense() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteExpense() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
