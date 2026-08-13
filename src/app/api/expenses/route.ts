import { NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/server/limits";
import * as storage from "@/lib/server/storage";
import { parsePagination } from "@/lib/server/pagination";
import { validationError, withAuth } from "@/lib/server/route";
import { createExpenseSchema } from "@/lib/schemas/misc";

export const GET = withAuth("GET /api/expenses", async ({ userId, request }) => {
  const data = await storage.getExpenses(userId, parsePagination(request));
  return NextResponse.json(data);
});

export const POST = withAuth("POST /api/expenses", async ({ userId, request }) => {
  const gate = await requireWriteAccess(userId);
  if (gate) return gate;

  const parsed = createExpenseSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);

  const expense = await storage.createExpense(userId, parsed.data);
  return NextResponse.json(expense, { status: 201 });
});
