import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/server/auth";
import { getUser, getSubscriptionStatus } from "@/lib/server/storage";
import { db } from "@/lib/server/db";
import {
  orders, orderItems, marketEvents, marketSales,
  expenses, companyProfiles, appSettings, invoiceCounters,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

const CURRENT_SCHEMA_VERSION = 1;

const migrateItemSchema = z.object({
  name: z.string().max(200).optional(),
  quantity: z.number().int().min(1).max(9999).optional(),
  price: z.union([z.number(), z.string()]).optional(),
  processingStatus: z.string().max(50).nullable().optional(),
  comment: z.string().max(5000).nullable().optional(),
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
  invoiceNumber: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  orderDate: z.string().max(50).optional(),
  serviceDate: z.string().max(50).nullable().optional(),
  shippingCost: z.union([z.number(), z.null()]).optional(),
  total: z.union([z.number(), z.string()]).optional(),
  processingStatus: z.string().max(50).nullable().optional(),
  comment: z.string().max(5000).nullable().optional(),
  items: z.array(migrateItemSchema).max(100).optional(),
});

const migrateMarketSchema = z.object({
  id: z.string().optional(), // used for marketSales mapping
  name: z.string().max(200).optional(),
  date: z.string().max(50).optional(),
  location: z.string().max(300).optional(),
  standFee: z.union([z.number(), z.string()]).optional(),
  travelCost: z.union([z.number(), z.string()]).optional(),
  notes: z.string().max(5000).optional(),
  status: z.string().max(50).nullable().optional(),
  quickItems: z.array(z.object({
    name: z.string().max(200),
    price: z.number().min(0).max(999999.99),
  })).max(50).nullable().optional(),
});

const migrateMarketSaleSchema = z.object({
  marketId: z.string(),
  description: z.string().max(200).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  quantity: z.number().int().min(1).max(9999).optional(),
});

const migrateExpenseSchema = z.object({
  description: z.string().max(200).optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  category: z.string().max(100).optional(),
  expenseDate: z.string().max(50).optional(),
  date: z.string().max(50).optional(), // legacy field name
});

const migrateProfileSchema = z.object({
  name: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  email: z.string().max(254).optional(),
  phone: z.string().max(50).optional(),
  taxNote: z.string().max(500).optional(),
  smallBusinessNote: z.string().max(500).nullable().optional(),
  defaultShippingCost: z.union([z.number(), z.null()]).optional(),
}).nullable().optional();

const migrateSettingsSchema = z.object({
  theme: z.string().max(50).optional(),
  currency: z.string().max(10).optional(),
}).nullable().optional();

const migrateSchema = z.object({
  schemaVersion: z.number().int().min(1).max(CURRENT_SCHEMA_VERSION).optional(),
  orders: z.array(migrateOrderSchema).max(500).optional(),
  markets: z.array(migrateMarketSchema).max(200).optional(),
  marketSales: z.array(migrateMarketSaleSchema).max(5000).optional(),
  expenses: z.array(migrateExpenseSchema).max(2000).optional(),
  profile: migrateProfileSchema,
  settings: migrateSettingsSchema,
  invoiceCounter: z.number().int().min(0).max(999999).optional(),
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

    // Only paying subscribers can import — prevents trial-abuse via account-hopping
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }
    const sub = getSubscriptionStatus(user);
    if (sub.status !== "active") {
      return NextResponse.json(
        { message: "Import requires an active subscription", code: "SUBSCRIPTION_REQUIRED" },
        { status: 403 }
      );
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

    // Entire restore runs in a single transaction — rollback on any failure
    await db.transaction(async (tx) => {
      // Step 1: Delete all existing user data
      await tx.delete(marketSales).where(eq(marketSales.userId, userId));
      const userOrders = await tx.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
      if (userOrders.length > 0) {
        await tx.delete(orderItems).where(inArray(orderItems.orderId, userOrders.map(o => o.id)));
      }
      await tx.delete(orders).where(eq(orders.userId, userId));
      await tx.delete(marketEvents).where(eq(marketEvents.userId, userId));
      await tx.delete(expenses).where(eq(expenses.userId, userId));
      await tx.delete(companyProfiles).where(eq(companyProfiles.userId, userId));
      await tx.delete(appSettings).where(eq(appSettings.userId, userId));
      await tx.delete(invoiceCounters).where(eq(invoiceCounters.userId, userId));

      // Step 2: Import orders (with original invoice numbers preserved)
      const now = new Date().toISOString();
      if (data.orders) {
        for (const order of data.orders) {
          const total = (order.items || []).reduce(
            (sum, item) => sum + toNum(item.price) * (item.quantity || 1), 0
          );
          const [inserted] = await tx.insert(orders).values({
            userId,
            customerName: order.customerName || "",
            customerEmail: order.customerEmail || "",
            customerStreet: order.customerStreet || order.customerAddress || "",
            customerZip: order.customerZip || "",
            customerCity: order.customerCity || "",
            customerCountry: order.customerCountry || "",
            status: order.status || "open",
            invoiceNumber: order.invoiceNumber || "",
            notes: order.notes || "",
            orderDate: order.orderDate || now.split("T")[0],
            serviceDate: order.serviceDate,
            shippingCost: order.shippingCost?.toString(),
            total: total.toString(),
            processingStatus: order.processingStatus,
            comment: order.comment,
            createdAt: now,
            updatedAt: now,
          }).returning();

          const items = order.items || [];
          if (items.length > 0) {
            await tx.insert(orderItems).values(
              items.map((item) => ({
                orderId: inserted.id,
                name: item.name || "",
                quantity: item.quantity || 1,
                price: toNum(item.price).toString(),
                processingStatus: item.processingStatus,
                comment: item.comment,
              }))
            );
          }
        }
      }

      // Step 3: Import markets
      const marketIdMap = new Map<string, string>();
      if (data.markets) {
        for (const market of data.markets) {
          const [inserted] = await tx.insert(marketEvents).values({
            userId,
            name: market.name || "",
            date: market.date || now.split("T")[0],
            location: market.location || "",
            standFee: toNum(market.standFee).toString(),
            travelCost: toNum(market.travelCost).toString(),
            notes: market.notes || "",
            status: market.status || "open",
            quickItems: market.quickItems,
            createdAt: now,
          }).returning();

          if (market.id) {
            marketIdMap.set(market.id, inserted.id);
          }
        }
      }

      // Step 4: Import market sales
      if (data.marketSales) {
        for (const sale of data.marketSales) {
          const newMarketId = marketIdMap.get(sale.marketId);
          if (newMarketId) {
            await tx.insert(marketSales).values({
              userId,
              marketId: newMarketId,
              description: sale.description || "",
              amount: toNum(sale.amount).toString(),
              quantity: sale.quantity || 1,
              createdAt: now,
            });
          }
        }
      }

      // Step 5: Import expenses
      if (data.expenses) {
        for (const expense of data.expenses) {
          await tx.insert(expenses).values({
            userId,
            description: expense.description || "",
            amount: toNum(expense.amount).toString(),
            category: expense.category || "Other",
            expenseDate: expense.expenseDate || expense.date || now.split("T")[0],
            createdAt: now,
          });
        }
      }

      // Step 6: Import profile
      if (data.profile) {
        await tx.insert(companyProfiles).values({
          userId,
          name: data.profile.name || "",
          address: data.profile.address || "",
          email: data.profile.email || "",
          phone: data.profile.phone || "",
          taxNote: data.profile.taxNote || "",
          smallBusinessNote: data.profile.smallBusinessNote ?? undefined,
          defaultShippingCost: data.profile.defaultShippingCost?.toString(),
        });
      }

      // Step 7: Import settings
      if (data.settings) {
        await tx.insert(appSettings).values({
          userId,
          theme: data.settings.theme || "system",
          currency: data.settings.currency || "€",
        });
      }

      // Step 8: Import invoice counter
      if (data.invoiceCounter != null && data.invoiceCounter > 0) {
        await tx.insert(invoiceCounters).values({
          userId,
          counter: data.invoiceCounter,
        });
      }
    });

    return NextResponse.json({ message: "Import successful" });
  } catch (error) {
    console.error("POST /api/migrate error:", error);
    return NextResponse.json({ message: "Import failed" }, { status: 500 });
  }
}
