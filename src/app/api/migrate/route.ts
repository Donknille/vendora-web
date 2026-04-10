import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";
import { z } from "zod";

const migrateItemSchema = z.object({
  name: z.string().max(200).optional(),
  quantity: z.number().int().min(1).max(9999).optional(),
  price: z.union([z.number(), z.string()]).optional(),
});

const migrateOrderSchema = z.object({
  customerName: z.string().max(200).optional(),
  customerEmail: z.string().max(254).optional(),
  customerAddress: z.string().max(500).optional(), // legacy, mapped to street
  customerStreet: z.string().max(200).optional(),
  customerZip: z.string().max(20).optional(),
  customerCity: z.string().max(100).optional(),
  customerCountry: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  orderDate: z.string().max(50).optional(),
  items: z.array(migrateItemSchema).max(100).optional(),
});

const migrateMarketSchema = z.object({
  name: z.string().max(200).optional(),
  date: z.string().max(50).optional(),
  location: z.string().max(300).optional(),
  standFee: z.union([z.number(), z.string()]).optional(),
  travelCost: z.union([z.number(), z.string()]).optional(),
  notes: z.string().max(5000).optional(),
});

const migrateExpenseSchema = z.object({
  description: z.string().max(200).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  category: z.string().max(100).optional(),
  expenseDate: z.string().max(50).optional(),
  date: z.string().max(50).optional(),
});

const migrateProfileSchema = z.object({
  name: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  email: z.string().max(254).optional(),
  phone: z.string().max(50).optional(),
  taxNote: z.string().max(500).optional(),
  smallBusinessNote: z.string().max(500).optional(),
  defaultShippingCost: z.number().min(0).max(99999.99).optional(),
}).optional();

const migrateSchema = z.object({
  orders: z.array(migrateOrderSchema).max(500).optional(),
  markets: z.array(migrateMarketSchema).max(200).optional(),
  expenses: z.array(migrateExpenseSchema).max(2000).optional(),
  profile: migrateProfileSchema,
});

function toNum(val: unknown): number {
  if (typeof val === "number") return Math.min(val, 999999.99);
  if (typeof val === "string") return Math.min(parseFloat(val) || 0, 999999.99);
  return 0;
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const raw = await request.json();
    const parsed = migrateSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Validation error", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Import orders
    if (data.orders) {
      for (const order of data.orders) {
        await storage.createOrder(userId, {
          customerName: order.customerName || "",
          customerEmail: order.customerEmail || "",
          customerStreet: order.customerStreet || order.customerAddress || "",
          customerZip: order.customerZip || "",
          customerCity: order.customerCity || "",
          customerCountry: order.customerCountry || "",
          status: order.status || "open",
          notes: order.notes || "",
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          items: (order.items || []).map((item) => ({
            name: item.name || "",
            quantity: item.quantity || 1,
            price: toNum(item.price),
          })),
        });
      }
    }

    // Import markets
    if (data.markets) {
      for (const market of data.markets) {
        await storage.createMarket(userId, {
          name: market.name || "",
          date: market.date || new Date().toISOString().split("T")[0],
          location: market.location || "",
          standFee: toNum(market.standFee),
          travelCost: toNum(market.travelCost),
          notes: market.notes || "",
        });
      }
    }

    // Import expenses
    if (data.expenses) {
      for (const expense of data.expenses) {
        await storage.createExpense(userId, {
          description: expense.description || "",
          amount: toNum(expense.amount),
          category: expense.category || "Other",
          expenseDate: expense.expenseDate || expense.date || new Date().toISOString().split("T")[0],
        });
      }
    }

    // Import profile
    if (data.profile) {
      await storage.upsertProfile(userId, {
        name: data.profile.name || "",
        address: data.profile.address || "",
        email: data.profile.email || "",
        phone: data.profile.phone || "",
        taxNote: data.profile.taxNote || "",
        smallBusinessNote: data.profile.smallBusinessNote,
        defaultShippingCost: data.profile.defaultShippingCost,
      });
    }

    return NextResponse.json({ message: "Import successful" });
  } catch (error) {
    console.error("POST /api/migrate error:", error);
    return NextResponse.json({ message: "Import failed" }, { status: 500 });
  }
}
