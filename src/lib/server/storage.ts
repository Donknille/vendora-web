import { eq, and, sql, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  orders,
  orderItems,
  marketEvents,
  marketSales,
  expenses,
  companyProfiles,
  appSettings,
  invoiceCounters,
  type User,
  type SelectOrder,
  type SelectOrderItem,
  type SelectMarketEvent,
  type SelectMarketSale,
  type SelectExpense,
  type SelectCompanyProfile,
  type SelectAppSettings,
} from "./schema";

// Response types with numeric conversion
export interface OrderWithItems extends Omit<SelectOrder, "total" | "shippingCost"> {
  total: number;
  shippingCost: number | null;
  items: OrderItemResponse[];
}

export interface OrderItemResponse extends Omit<SelectOrderItem, "price"> {
  price: number;
}

export interface MarketEventResponse extends Omit<SelectMarketEvent, "standFee" | "travelCost"> {
  standFee: number;
  travelCost: number;
}

export interface MarketSaleResponse extends Omit<SelectMarketSale, "amount"> {
  amount: number;
}

export interface ExpenseResponse extends Omit<SelectExpense, "amount"> {
  amount: number;
}

export interface CompanyProfileResponse extends Omit<SelectCompanyProfile, "defaultShippingCost"> {
  defaultShippingCost: number | null;
}

export interface SubscriptionInfo {
  status: "trial" | "active" | "expired" | "cancelled";
  isActive: boolean;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  daysRemaining: number | null;
}

function toNumber(val: string | null | undefined): number {
  return val ? parseFloat(val) : 0;
}

function toNumberOrNull(val: string | null | undefined): number | null {
  return val != null ? parseFloat(val) : null;
}

// ── Users ──────────────────────────────────────────────────

export async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

// ── Orders ─────────────────────────────────────────────────

function buildOrderWithItems(order: SelectOrder, items: SelectOrderItem[]): OrderWithItems {
  return {
    ...order,
    total: toNumber(order.total),
    shippingCost: toNumberOrNull(order.shippingCost),
    items: items.map((i) => ({ ...i, price: toNumber(i.price) })),
  };
}

export async function getOrders(userId: string): Promise<OrderWithItems[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(sql`${orders.createdAt} DESC`);

  if (rows.length === 0) return [];

  // Fetch ALL items for ALL orders in ONE query (eliminates N+1)
  const orderIds = rows.map((o) => o.id);
  const allItems = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const itemsByOrder = new Map<string, SelectOrderItem[]>();
  for (const item of allItems) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  return rows.map((o) => buildOrderWithItems(o, itemsByOrder.get(o.id) || []));
}

export async function getOrder(userId: string, id: string): Promise<OrderWithItems | undefined> {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, userId)));
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return buildOrderWithItems(order, items);
}

export async function createOrder(
  userId: string,
  data: {
    customerName: string;
    customerEmail: string;
    customerStreet: string;
    customerZip: string;
    customerCity: string;
    customerCountry?: string;
    status: string;
    notes: string;
    orderDate: string;
    serviceDate?: string;
    shippingCost?: number;
    processingStatus?: string;
    comment?: string;
    items: { name: string; quantity: number; price: number; processingStatus?: string; comment?: string }[];
  }
): Promise<OrderWithItems> {
  const invoiceNumber = await getNextInvoiceNumber(userId);
  const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const now = new Date().toISOString();

  const [order] = await db
    .insert(orders)
    .values({
      userId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerStreet: data.customerStreet,
      customerZip: data.customerZip,
      customerCity: data.customerCity,
      customerCountry: data.customerCountry || "",
      status: data.status,
      invoiceNumber,
      notes: data.notes,
      orderDate: data.orderDate || now,
      serviceDate: data.serviceDate,
      shippingCost: data.shippingCost?.toString(),
      total: total.toString(),
      processingStatus: data.processingStatus,
      comment: data.comment,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const insertedItems =
    data.items.length > 0
      ? await db
          .insert(orderItems)
          .values(
            data.items.map((item) => ({
              orderId: order.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price.toString(),
              processingStatus: item.processingStatus,
              comment: item.comment,
            }))
          )
          .returning()
      : [];

  return {
    ...order,
    total,
    shippingCost: data.shippingCost ?? null,
    items: insertedItems.map((i) => ({ ...i, price: toNumber(i.price) })),
  };
}

export async function updateOrder(
  userId: string,
  id: string,
  updates: {
    customerName?: string;
    customerEmail?: string;
    customerStreet?: string;
    customerZip?: string;
    customerCity?: string;
    customerCountry?: string;
    status?: string;
    notes?: string;
    orderDate?: string;
    serviceDate?: string;
    shippingCost?: number;
    processingStatus?: string;
    comment?: string;
    items?: { id?: string; name: string; quantity: number; price: number; processingStatus?: string; comment?: string }[];
  }
): Promise<OrderWithItems | undefined> {
  const existing = await getOrder(userId, id);
  if (!existing) return undefined;

  const { items: newItems, ...fields } = updates;
  const dbUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (fields.customerName !== undefined) dbUpdates.customerName = fields.customerName;
  if (fields.customerEmail !== undefined) dbUpdates.customerEmail = fields.customerEmail;
  if (fields.customerStreet !== undefined) dbUpdates.customerStreet = fields.customerStreet;
  if (fields.customerZip !== undefined) dbUpdates.customerZip = fields.customerZip;
  if (fields.customerCity !== undefined) dbUpdates.customerCity = fields.customerCity;
  if (fields.customerCountry !== undefined) dbUpdates.customerCountry = fields.customerCountry;
  if (fields.status !== undefined) dbUpdates.status = fields.status;
  if (fields.notes !== undefined) dbUpdates.notes = fields.notes;
  if (fields.orderDate !== undefined) dbUpdates.orderDate = fields.orderDate;
  if (fields.serviceDate !== undefined) dbUpdates.serviceDate = fields.serviceDate;
  if (fields.shippingCost !== undefined) dbUpdates.shippingCost = fields.shippingCost.toString();
  if (fields.processingStatus !== undefined) dbUpdates.processingStatus = fields.processingStatus;
  if (fields.comment !== undefined) dbUpdates.comment = fields.comment;

  if (newItems) {
    const total = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    dbUpdates.total = total.toString();
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    if (newItems.length > 0) {
      await db.insert(orderItems).values(
        newItems.map((item) => ({
          orderId: id,
          name: item.name,
          quantity: item.quantity,
          price: item.price.toString(),
          processingStatus: item.processingStatus,
          comment: item.comment,
        }))
      );
    }
  }

  await db.update(orders).set(dbUpdates).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  return getOrder(userId, id);
}

export async function deleteOrder(userId: string, id: string): Promise<void> {
  await db.delete(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
}

// ── Markets ────────────────────────────────────────────────

function toMarketResponse(m: SelectMarketEvent): MarketEventResponse {
  return { ...m, standFee: toNumber(m.standFee), travelCost: toNumber(m.travelCost) };
}

export async function getMarkets(userId: string): Promise<MarketEventResponse[]> {
  const rows = await db
    .select()
    .from(marketEvents)
    .where(eq(marketEvents.userId, userId))
    .orderBy(sql`${marketEvents.createdAt} DESC`);
  return rows.map(toMarketResponse);
}

export async function getMarket(userId: string, id: string): Promise<MarketEventResponse | undefined> {
  const [market] = await db
    .select()
    .from(marketEvents)
    .where(and(eq(marketEvents.id, id), eq(marketEvents.userId, userId)));
  return market ? toMarketResponse(market) : undefined;
}

export async function createMarket(
  userId: string,
  data: { name: string; date: string; location: string; standFee: number; travelCost: number; notes: string; status?: string; quickItems?: { name: string; price: number }[] }
): Promise<MarketEventResponse> {
  const [market] = await db
    .insert(marketEvents)
    .values({
      userId,
      name: data.name,
      date: data.date,
      location: data.location,
      standFee: data.standFee.toString(),
      travelCost: data.travelCost.toString(),
      notes: data.notes,
      status: data.status || "open",
      quickItems: data.quickItems,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return toMarketResponse(market);
}

export async function updateMarket(
  userId: string,
  id: string,
  updates: Partial<{ name: string; date: string; location: string; standFee: number; travelCost: number; notes: string; status: string; quickItems: { name: string; price: number }[] }>
): Promise<MarketEventResponse | undefined> {
  const existing = await getMarket(userId, id);
  if (!existing) return undefined;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.standFee !== undefined) dbUpdates.standFee = updates.standFee.toString();
  if (updates.travelCost !== undefined) dbUpdates.travelCost = updates.travelCost.toString();
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.quickItems !== undefined) dbUpdates.quickItems = updates.quickItems;

  await db.update(marketEvents).set(dbUpdates).where(and(eq(marketEvents.id, id), eq(marketEvents.userId, userId)));
  return getMarket(userId, id);
}

export async function deleteMarket(userId: string, id: string): Promise<void> {
  await db.delete(marketEvents).where(and(eq(marketEvents.id, id), eq(marketEvents.userId, userId)));
}

// ── Market Sales ───────────────────────────────────────────

function toSaleResponse(s: SelectMarketSale): MarketSaleResponse {
  return { ...s, amount: toNumber(s.amount) };
}

export async function getMarketSales(userId: string, marketId: string): Promise<MarketSaleResponse[]> {
  const rows = await db
    .select()
    .from(marketSales)
    .where(and(eq(marketSales.userId, userId), eq(marketSales.marketId, marketId)))
    .orderBy(sql`${marketSales.createdAt} DESC`);
  return rows.map(toSaleResponse);
}

export async function getAllMarketSales(userId: string): Promise<MarketSaleResponse[]> {
  const rows = await db
    .select()
    .from(marketSales)
    .where(eq(marketSales.userId, userId))
    .orderBy(sql`${marketSales.createdAt} DESC`);
  return rows.map(toSaleResponse);
}

export interface MarketSaleWriteInput {
  clientId: string;
  description: string;
  amount: number;
  quantity: number;
  createdAt: string; // ISO-8601 sale time from the client (V2)
}

// Columns returned to the client. The server-generated `id` and `receivedAt`
// are included; `receivedAt` is set by the DB default on insert and never
// touched on replay (see below).
const marketSaleReturning = {
  id: marketSales.id,
  userId: marketSales.userId,
  marketId: marketSales.marketId,
  clientId: marketSales.clientId,
  description: marketSales.description,
  amount: marketSales.amount,
  quantity: marketSales.quantity,
  createdAt: marketSales.createdAt,
  receivedAt: marketSales.receivedAt,
};

function toSaleValues(userId: string, marketId: string, data: MarketSaleWriteInput) {
  return {
    userId,
    marketId,
    clientId: data.clientId,
    description: data.description,
    amount: data.amount.toString(),
    quantity: data.quantity,
    createdAt: data.createdAt,
    // receivedAt is left to the DB default (server time, V2).
  };
}

/**
 * V1: idempotent insert keyed on (user_id, client_id). The onConflictDoUpdate
 * with a no-op set on client_id returns the row on both the first insert and a
 * replay, so no second SELECT is needed. `inserted` distinguishes a fresh
 * insert from a replay via the xmax system column (0 for a freshly inserted
 * tuple, non-zero for the on-conflict update path) so the route can answer 201
 * vs 200.
 */
export async function upsertMarketSale(
  userId: string,
  marketId: string,
  data: MarketSaleWriteInput
): Promise<{ row: MarketSaleResponse; inserted: boolean }> {
  const [result] = await db
    .insert(marketSales)
    .values(toSaleValues(userId, marketId, data))
    .onConflictDoUpdate({
      target: [marketSales.userId, marketSales.clientId],
      set: { clientId: data.clientId },
    })
    .returning({
      ...marketSaleReturning,
      inserted: sql<boolean>`(xmax::text::bigint = 0)`,
    });
  const { inserted, ...row } = result;
  return { row: toSaleResponse(row), inserted };
}

/**
 * Multi-row variant of the idempotent upsert for the batch route. Uses
 * `excluded.client_id` for the no-op set so every conflicting row keeps its own
 * value (a per-row no-op) instead of being clobbered with a single literal.
 * Callers must dedupe by clientId first — Postgres rejects a batch that would
 * touch the same conflict target twice.
 */
export async function upsertMarketSalesBatch(
  userId: string,
  marketId: string,
  entries: MarketSaleWriteInput[]
): Promise<MarketSaleResponse[]> {
  if (entries.length === 0) return [];
  const rows = await db
    .insert(marketSales)
    .values(entries.map((e) => toSaleValues(userId, marketId, e)))
    .onConflictDoUpdate({
      target: [marketSales.userId, marketSales.clientId],
      set: { clientId: sql`excluded.client_id` },
    })
    .returning(marketSaleReturning);
  return rows.map(toSaleResponse);
}

/**
 * Deletes a sale by its server id, scoped to the user. Idempotent /
 * replay-safe: deleting an already-deleted (or synced-then-removed) booking
 * returns `false` without erroring, so a repeated delete op from the offline
 * queue never turns into a hard failure.
 */
export async function deleteMarketSale(userId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(marketSales)
    .where(and(eq(marketSales.id, id), eq(marketSales.userId, userId)))
    .returning({ id: marketSales.id });
  return deleted.length > 0;
}

// ── Expenses ───────────────────────────────────────────────

function toExpenseResponse(e: SelectExpense): ExpenseResponse {
  return { ...e, amount: toNumber(e.amount) };
}

export async function getExpenses(userId: string): Promise<ExpenseResponse[]> {
  const rows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .orderBy(sql`${expenses.createdAt} DESC`);
  return rows.map(toExpenseResponse);
}

export async function createExpense(
  userId: string,
  data: { description: string; amount: number; category: string; expenseDate: string }
): Promise<ExpenseResponse> {
  const now = new Date().toISOString();
  const [expense] = await db
    .insert(expenses)
    .values({
      userId,
      description: data.description,
      amount: data.amount.toString(),
      category: data.category,
      expenseDate: data.expenseDate || now.split("T")[0],
      createdAt: now,
    })
    .returning();
  return toExpenseResponse(expense);
}

export async function deleteExpense(userId: string, id: string): Promise<void> {
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
}

// ── Profile ────────────────────────────────────────────────

function toProfileResponse(p: SelectCompanyProfile): CompanyProfileResponse {
  return { ...p, defaultShippingCost: toNumberOrNull(p.defaultShippingCost) };
}

export async function getProfile(userId: string): Promise<CompanyProfileResponse> {
  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
  if (profile) return toProfileResponse(profile);
  return { id: "", userId, name: "", address: "", email: "", phone: "", taxNote: "", smallBusinessNote: null, defaultShippingCost: null };
}

export async function upsertProfile(
  userId: string,
  data: { name: string; address: string; email: string; phone: string; taxNote: string; smallBusinessNote?: string; defaultShippingCost?: number }
): Promise<CompanyProfileResponse> {
  const [profile] = await db
    .insert(companyProfiles)
    .values({
      userId,
      name: data.name,
      address: data.address,
      email: data.email,
      phone: data.phone,
      taxNote: data.taxNote,
      smallBusinessNote: data.smallBusinessNote,
      defaultShippingCost: data.defaultShippingCost?.toString(),
    })
    .onConflictDoUpdate({
      target: companyProfiles.userId,
      set: {
        name: data.name,
        address: data.address,
        email: data.email,
        phone: data.phone,
        taxNote: data.taxNote,
        smallBusinessNote: data.smallBusinessNote,
        defaultShippingCost: data.defaultShippingCost?.toString(),
      },
    })
    .returning();
  return toProfileResponse(profile);
}

// ── Settings ───────────────────────────────────────────────

export async function getSettings(userId: string): Promise<SelectAppSettings> {
  const [settings] = await db.select().from(appSettings).where(eq(appSettings.userId, userId));
  if (settings) return settings;
  return { id: "", userId, theme: "system", currency: "€" };
}

export async function upsertSettings(
  userId: string,
  data: { theme: string; currency: string }
): Promise<SelectAppSettings> {
  const [settings] = await db
    .insert(appSettings)
    .values({ userId, theme: data.theme, currency: data.currency })
    .onConflictDoUpdate({
      target: appSettings.userId,
      set: { theme: data.theme, currency: data.currency },
    })
    .returning();
  return settings;
}

// ── Invoice Counter ────────────────────────────────────────

export async function getNextInvoiceNumber(userId: string): Promise<string> {
  const [result] = await db
    .insert(invoiceCounters)
    .values({ userId, counter: 1 })
    .onConflictDoUpdate({
      target: invoiceCounters.userId,
      set: { counter: sql`${invoiceCounters.counter} + 1` },
    })
    .returning();

  const year = new Date().getFullYear().toString().slice(-2);
  return `${year}-${result.counter.toString().padStart(3, "0")}`;
}

// ── Subscription ───────────────────────────────────────────

export async function updateSubscription(
  userId: string,
  data: Partial<{ subscriptionStatus: string; trialEndsAt: Date; subscriptionExpiresAt: Date; stripeCustomerId: string; stripeSubscriptionId: string }>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.subscriptionStatus !== undefined) updates.subscriptionStatus = data.subscriptionStatus;
  if (data.trialEndsAt !== undefined) updates.trialEndsAt = data.trialEndsAt;
  if (data.subscriptionExpiresAt !== undefined) updates.subscriptionExpiresAt = data.subscriptionExpiresAt;
  if (data.stripeCustomerId !== undefined) updates.stripeCustomerId = data.stripeCustomerId;
  if (data.stripeSubscriptionId !== undefined) updates.stripeSubscriptionId = data.stripeSubscriptionId;

  await db.update(users).set(updates).where(eq(users.id, userId));
}

export function getSubscriptionStatus(user: User): SubscriptionInfo {
  const now = new Date();
  const status = (user.subscriptionStatus || "trial") as SubscriptionInfo["status"];

  if (status === "active" && user.subscriptionExpiresAt) {
    const expiresAt = new Date(user.subscriptionExpiresAt);
    if (expiresAt > now) {
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "active", isActive: true, trialEndsAt: user.trialEndsAt?.toISOString() ?? null, subscriptionExpiresAt: expiresAt.toISOString(), daysRemaining };
    }
    return { status: "expired", isActive: false, trialEndsAt: user.trialEndsAt?.toISOString() ?? null, subscriptionExpiresAt: expiresAt.toISOString(), daysRemaining: 0 };
  }

  if (status === "trial" && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    if (trialEnd > now) {
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "trial", isActive: true, trialEndsAt: trialEnd.toISOString(), subscriptionExpiresAt: null, daysRemaining };
    }
    return { status: "expired", isActive: false, trialEndsAt: trialEnd.toISOString(), subscriptionExpiresAt: null, daysRemaining: 0 };
  }

  if (status === "trial" && !user.trialEndsAt) {
    return { status: "expired", isActive: false, trialEndsAt: null, subscriptionExpiresAt: null, daysRemaining: 0 };
  }

  return {
    status: status === "cancelled" ? "cancelled" : "expired",
    isActive: false,
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
    daysRemaining: 0,
  };
}
