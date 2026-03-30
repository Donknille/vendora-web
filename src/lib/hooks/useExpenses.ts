import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import type { Expense } from "@/lib/types";

const KEY = ["/api/expenses"];

export function useExpenses() {
  return useQuery<Expense[]>({ queryKey: KEY });
}

export function useCreateExpense() {
  return useMutation({
    mutationFn: async (data: {
      description: string;
      amount: number;
      category: string;
      expenseDate: string;
    }) => {
      const res = await apiRequest("POST", "/api/expenses", data);
      return res.json() as Promise<Expense>;
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
