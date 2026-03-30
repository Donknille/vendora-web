import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import * as storage from "@/lib/server/storage";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    // Import orders
    if (data.orders && Array.isArray(data.orders)) {
      for (const order of data.orders) {
        await storage.createOrder(userId, {
          customerName: order.customerName || "",
          customerEmail: order.customerEmail || "",
          customerAddress: order.customerAddress || "",
          status: order.status || "open",
          notes: order.notes || "",
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          items: (order.items || []).map((item: { name?: string; quantity?: number; price?: number | string }) => ({
            name: item.name || "",
            quantity: item.quantity || 1,
            price: typeof item.price === "number" ? item.price : parseFloat(String(item.price)) || 0,
          })),
        });
      }
    }

    // Import markets
    if (data.markets && Array.isArray(data.markets)) {
      for (const market of data.markets) {
        await storage.createMarket(userId, {
          name: market.name || "",
          date: market.date || new Date().toISOString().split("T")[0],
          location: market.location || "",
          standFee: typeof market.standFee === "number" ? market.standFee : parseFloat(String(market.standFee)) || 0,
          travelCost: typeof market.travelCost === "number" ? market.travelCost : parseFloat(String(market.travelCost)) || 0,
          notes: market.notes || "",
        });
      }
    }

    // Import expenses
    if (data.expenses && Array.isArray(data.expenses)) {
      for (const expense of data.expenses) {
        await storage.createExpense(userId, {
          description: expense.description || "",
          amount: typeof expense.amount === "number" ? expense.amount : parseFloat(String(expense.amount)) || 0,
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
