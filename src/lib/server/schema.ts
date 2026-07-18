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
  index,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================
// Users — app profile keyed by the Better Auth user.id.
// Better Auth owns the `user`/`session`/`account` tables (see auth-schema.ts);
// this table holds app-specific fields (subscription, Stripe, soft-delete).
// ============================================================
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // == Better Auth user.id
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Subscription fields
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Admin
  isBlocked: boolean("is_blocked").default(false),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("idx_users_stripe_customer_id").on(t.stripeCustomerId),
  check(
    "chk_users_subscription_status",
    sql`${t.subscriptionStatus} in ('trial', 'active', 'expired', 'cancelled')`
  ),
]);

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
  customerStreet: text("customer_street").notNull().default(""),
  customerZip: text("customer_zip").notNull().default(""),
  customerCity: text("customer_city").notNull().default(""),
  customerCountry: text("customer_country").notNull().default(""),
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
}, (t) => [
  index("idx_orders_user_id").on(t.userId),
  index("idx_orders_user_status").on(t.userId, t.status),
  check(
    "chk_orders_status",
    sql`${t.status} in ('open', 'paid', 'shipped', 'delivered', 'cancelled')`
  ),
]);

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
}, (t) => [
  index("idx_order_items_order_id").on(t.orderId),
]);

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
}, (t) => [
  index("idx_market_events_user_id").on(t.userId),
  check(
    "chk_market_events_status",
    sql`${t.status} in ('open', 'completed', 'cancelled')`
  ),
]);

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
}, (t) => [
  index("idx_market_sales_user_id").on(t.userId),
  index("idx_market_sales_market_id").on(t.marketId),
]);

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
}, (t) => [
  index("idx_expenses_user_id").on(t.userId),
]);

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

// ============================================================
// Better Auth tables (user / session / account / verification)
// Re-exported so drizzle-kit (schema: schema.ts) creates them too.
// ============================================================
export * from "./auth-schema";
