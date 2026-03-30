import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  expenseDate: z.string().min(1, "Expense date is required"),
});

export async function GET() {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const data = await storage.getExpenses(userId);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const sub = storage.getSubscriptionStatus(user);
  if (!sub.isActive) {
    return NextResponse.json(
      { message: "Subscription required", code: "SUBSCRIPTION_REQUIRED", subscription: sub },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const expense = await storage.createExpense(userId, parsed.data);
  return NextResponse.json(expense, { status: 201 });
}
