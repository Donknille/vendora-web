import { NextResponse } from "next/server";
import * as storage from "@/lib/server/storage";
import { withAuth } from "@/lib/server/route";

export const GET = withAuth("GET /api/customers", async ({ userId }) => {
  const customers = await storage.getCustomers(userId);
  return NextResponse.json(customers);
});
