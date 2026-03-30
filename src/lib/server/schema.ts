import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================
// Users — managed by Supabase Auth, but we store app-specific fields
// ============================================================
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // Supabase Auth UID
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Subscription fields
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
});

export type User = typeof users.$inferSelect;

// ============================================================
// Orders
// ============================================================
export const orders = pgTable("orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  customerAddress: text("customer_address").notNull().default(""),
  status: text("status").notNull().default("open"),
  invoiceNumber: text("invoice_number").notNull().default(""),
  notes: text("notes").notNull().default(""),
  orderDate: text("order_date").notNull(),
  serviceDate: text("service_date"),
  shippingCost: numeric("shipping_cost"),
  total: numeric("total").notNull().default("0"),
  processingStatus: text("processing_status"),
  comment: text("comment"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type SelectOrder = typeof orders.$inferSelect;

// ============================================================
// Order Items
// ============================================================
export const orderItems = pgTable("order_items", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orderId: varchar("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price").notNull().default("0"),
  processingStatus: text("processing_status"),
  comment: text("comment"),
});

export type SelectOrderItem = typeof orderItems.$inferSelect;

// ============================================================
// Market Events
// ============================================================
export const marketEvents = pgTable("market_events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  date: text("date").notNull(),
  location: text("location").notNull().default(""),
  standFee: numeric("stand_fee").notNull().default("0"),
  travelCost: numeric("travel_cost").notNull().default("0"),
  notes: text("notes").notNull().default(""),
  status: text("status").default("open"),
  quickItems: jsonb("quick_items").$type<{ name: string; price: number }[]>(),
  createdAt: text("created_at").notNull(),
});

export type SelectMarketEvent = typeof marketEvents.$inferSelect;

// ============================================================
// Market Sales
// ============================================================
export const marketSales = pgTable("market_sales", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  marketId: varchar("market_id")
    .notNull()
    .references(() => marketEvents.id, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  amount: numeric("amount").notNull().default("0"),
  quantity: integer("quantity").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export type SelectMarketSale = typeof marketSales.$inferSelect;

// ============================================================
// Expenses
// ============================================================
export const expenses = pgTable("expenses", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  amount: numeric("amount").notNull().default("0"),
  category: text("category").notNull().default(""),
  expenseDate: text("expense_date").notNull(),
  createdAt: text("created_at").notNull(),
});

export type SelectExpense = typeof expenses.$inferSelect;

// ============================================================
// Company Profiles (1:1 per user)
// ============================================================
export const companyProfiles = pgTable("company_profiles", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  address: text("address").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  taxNote: text("tax_note").notNull().default(""),
  smallBusinessNote: text("small_business_note"),
  defaultShippingCost: numeric("default_shipping_cost"),
});

export type SelectCompanyProfile = typeof companyProfiles.$inferSelect;

// ============================================================
// App Settings (1:1 per user)
// ============================================================
export const appSettings = pgTable("app_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"),
  currency: text("currency").notNull().default("€"),
});

export type SelectAppSettings = typeof appSettings.$inferSelect;

// ============================================================
// Invoice Counters (1:1 per user)
// ============================================================
export const invoiceCounters = pgTable("invoice_counters", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  counter: integer("counter").notNull().default(0),
});
