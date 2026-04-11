import { NextResponse } from "next/server";
import { getAuthUserId, requireActiveSubscription } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(200),
  amount: z.number().min(0).max(999999.99),
  category: z.string().min(1, "Category is required").max(100),
  expenseDate: z.string().min(1, "Date is required").max(50),
});

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await storage.getExpenses(userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const subCheck = await requireActiveSubscription(userId);
    if (subCheck) return subCheck;

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
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
