import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
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
  // Optional link to the customer master record; the address fields below stay a
  // snapshot so the order is unaffected if the customer is later edited/deleted.
  customerId: varchar("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  customerStreet: text("customer_street").notNull().default(""),
  customerZip: text("customer_zip").notNull().default(""),
  customerCity: text("customer_city").notNull().default(""),
  customerCountry: text("customer_country").notNull().default(""),
  status: text("status").notNull().default("open"),
  invoiceNumber: text("invoice_number").notNull().default(""),
  notes: text("notes").notNull().default(""),
  orderDate: date("order_date").notNull(),
  serviceDate: date("service_date"),
  paidAt: date("paid_at"), // Zuflussdatum (gesetzt bei Statuswechsel auf 'paid')
  paymentMethod: text("payment_method"),
  shippingCost: integer("shipping_cost"), // cents
  total: integer("total").notNull().default(0), // cents
  processingStatus: text("processing_status"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_orders_user_id").on(t.userId),
  index("idx_orders_user_status").on(t.userId, t.status),
  index("idx_orders_user_paid_at").on(t.userId, t.paidAt),
  check(
    "chk_orders_status",
    sql`${t.status} in ('open', 'paid', 'shipped', 'delivered', 'cancelled')`
  ),
  check(
    "chk_orders_payment_method",
    sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('cash', 'card', 'transfer', 'paypal', 'other')`
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
  price: integer("price").notNull().default(0), // cents
  processingStatus: text("processing_status"),
  comment: text("comment"),
}, (t) => [
  index("idx_order_items_order_id").on(t.orderId),
]);

export type SelectOrderItem = typeof orderItems.$inferSelect;

// ============================================================
// Customers — per-user master record, fed from order recipients.
// Powers autocomplete in the order form; orders keep their own address snapshot.
// ============================================================
export const customers = pgTable("customers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  street: text("street").notNull().default(""),
  zip: text("zip").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_customers_user_id").on(t.userId),
]);

export type SelectCustomer = typeof customers.$inferSelect;

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
  date: date("date").notNull(),
  location: text("location").notNull().default(""),
  standFee: integer("stand_fee").notNull().default(0), // cents
  travelCost: integer("travel_cost").notNull().default(0), // cents
  notes: text("notes").notNull().default(""),
  status: text("status").default("open"),
  // Application deadline for the stall (Marktkalender, Phase 3.4).
  applicationDeadline: date("application_deadline"),
  quickItems: jsonb("quick_items").$type<{ name: string; price: number }[]>(), // price in cents
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_market_events_user_id").on(t.userId),
  check(
    "chk_market_events_status",
    sql`${t.status} in ('open', 'applied', 'confirmed', 'completed', 'cancelled')`
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
  // Client-generated idempotency key for the offline sale queue (Phase 3.2).
  // Null for server-created/legacy rows. Scoped-unique per user so a queued sale
  // synced more than once (retry, multi-device) is inserted exactly once.
  clientId: text("client_id"),
  description: text("description").notNull().default(""),
  amount: integer("amount").notNull().default(0), // cents
  quantity: integer("quantity").notNull().default(1),
  paymentMethod: text("payment_method"), // 'cash' | 'card' | null (Phase 3.3)
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_market_sales_user_id").on(t.userId),
  index("idx_market_sales_market_id").on(t.marketId),
  uniqueIndex("uq_market_sales_user_client").on(t.userId, t.clientId),
  check(
    "chk_market_sales_payment_method",
    sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('cash', 'card')`
  ),
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
  // Set for auto-derived market cost rows (source market_fee/market_travel);
  // null for manual expenses. Cascade-deleted with the market.
  marketId: varchar("market_id").references(() => marketEvents.id, { onDelete: "cascade" }),
  description: text("description").notNull().default(""),
  amount: integer("amount").notNull().default(0), // cents
  category: text("category").notNull().default("sonstiges"),
  source: text("source").notNull().default("manual"),
  expenseDate: date("expense_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_expenses_user_id").on(t.userId),
  index("idx_expenses_market_id").on(t.marketId),
  check(
    "chk_expenses_category",
    sql`${t.category} in ('wareneinkauf_material', 'standgebuehren_raumkosten', 'fahrtkosten', 'arbeitsmittel_gwg', 'verpackung', 'marketing', 'versicherungen_beitraege', 'software_gebuehren', 'sonstiges')`
  ),
  check(
    "chk_expenses_source",
    sql`${t.source} in ('manual', 'market_fee', 'market_travel')`
  ),
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
  isSmallBusiness: boolean("is_small_business").notNull().default(true),
  defaultShippingCost: integer("default_shipping_cost"), // cents
});

export type SelectCompanyProfile = typeof companyProfiles.$inferSelect;

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
// Invoices — immutable legal document snapshot (GoBD).
// Created only on explicit issuance from an order. Never UPDATEd once issued
// (except pdfUrl on generation, and status→'cancelled' via the Storno flow).
// Corrections are made by issuing a `cancellation` invoice (negative amounts,
// new number, reference to the original) and re-issuing.
// All money fields are integer cents.
// ============================================================
export const invoices = pgTable("invoices", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  // Nullable + set-null on user delete: on account deletion the invoice is
  // *decoupled* from the account (userId → null) and retained (see archivedAt).
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  // The order this invoice was issued for. Nullable + set-null on order delete
  // so the immutable invoice survives even if the working order is later removed.
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").notNull(),
  type: text("type").notNull().default("invoice"), // 'invoice' | 'cancellation'
  status: text("status").notNull().default("issued"), // 'issued' | 'cancelled'
  // For a cancellation invoice: the original invoice it reverses (app-enforced ref).
  cancelsInvoiceId: varchar("cancels_invoice_id"),
  issueDate: date("issue_date").notNull(), // Rechnungsdatum
  serviceDate: date("service_date"), // Leistungsdatum (E-Rechnung-ready)
  // Seller snapshot (from company profile at issuance)
  sellerName: text("seller_name").notNull().default(""),
  sellerAddress: text("seller_address").notNull().default(""),
  sellerEmail: text("seller_email").notNull().default(""),
  sellerPhone: text("seller_phone").notNull().default(""),
  // Recipient snapshot (structured, E-Rechnung-ready)
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  customerStreet: text("customer_street").notNull().default(""),
  customerZip: text("customer_zip").notNull().default(""),
  customerCity: text("customer_city").notNull().default(""),
  customerCountry: text("customer_country").notNull().default(""),
  // Line-item snapshot (cents)
  items: jsonb("items")
    .$type<{ name: string; quantity: number; price: number }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  subtotal: integer("subtotal").notNull().default(0), // cents
  shippingCost: integer("shipping_cost").notNull().default(0), // cents
  total: integer("total").notNull().default(0), // cents (negative for cancellation)
  // Frozen tax notice + small-business flag at issuance
  taxNote: text("tax_note").notNull().default(""),
  isSmallBusiness: boolean("is_small_business").notNull().default(true),
  notes: text("notes").notNull().default(""),
  pdfUrl: text("pdf_url"), // reserved; PDFs are rendered on demand (Phase 2.2)
  // DSGVO/GoBD retention: set when the owning account is deleted. The invoice is
  // kept (decoupled) until retentionUntil (§147 AO / §14b UStG, ~10 years).
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  retentionUntil: date("retention_until"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idx_invoices_user_id").on(t.userId),
  index("idx_invoices_order_id").on(t.orderId),
  // A user's invoice numbers are unique (GoBD: no duplicates).
  uniqueIndex("uq_invoices_user_number").on(t.userId, t.invoiceNumber),
  check("chk_invoices_type", sql`${t.type} in ('invoice', 'cancellation')`),
  check("chk_invoices_status", sql`${t.status} in ('issued', 'cancelled')`),
]);

export type SelectInvoice = typeof invoices.$inferSelect;

// ============================================================
// Webhook Events — idempotency ledger for Stripe webhooks.
// Each Stripe event.id is recorded once; replays are ignored.
// ============================================================
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ============================================================
// Better Auth tables (user / session / account / verification)
// Re-exported so drizzle-kit (schema: schema.ts) creates them too.
// ============================================================
export * from "./auth-schema";
