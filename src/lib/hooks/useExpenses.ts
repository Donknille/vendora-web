import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import type { Expense } from "@/lib/types";

function useKey() {
  const userId = useCurrentUserId();
  return [userId, "/api/expenses"] as const;
}

/** An expense write changes the dashboard/EÜR figures too. */
function useInvalidateExpenseWrites() {
  const userId = useCurrentUserId();
  return () => {
    for (const path of ["/api/expenses", "/api/dashboard"]) {
      queryClient.invalidateQueries({ queryKey: [userId, path] });
    }
  };
}

export function useExpenses() {
  const key = useKey();
  return useAppQuery<Expense[]>([...key]);
}

export function useCreateExpense() {
  const invalidate = useInvalidateExpenseWrites();
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
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateExpenseWrites();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: invalidate,
  });
}
