import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { Expense } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/expenses"] as const;
}

export function useExpenses() {
  const key = useKey();
  return useAppQuery<Expense[]>([...key]);
}

export function useCreateExpense() {
  const key = useKey();
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
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}

export function useDeleteExpense() {
  const key = useKey();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...key] });
    },
  });
}
