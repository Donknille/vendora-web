import "server-only";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";
import { deriveMarketCosts } from "@/lib/marketCosts";
import { isPaidLike } from "@/lib/orderStatus";
import {
  buildInvoiceSnapshot,
  buildCancellationSnapshot,
  computeRetentionUntil,
  type InvoiceSnapshot,
  type InvoiceType,
} from "@/lib/invoice";
import { db } from "./db";
import {
  users,
  orders,
  orderItems,
  marketEvents,
  marketSales,
  expenses,
  companyProfiles,
  invoiceCounters,
  invoices,
  type User,
  type SelectOrder,
  type SelectOrderItem,
  type SelectMarketEvent,
  type SelectMarketSale,
  type SelectExpense,
  type SelectCompanyProfile,
  type SelectInvoice,
} from "./schema";

// Response types. All money fields are integer cents (no conversion needed —
// the columns are `integer`). createdAt/updatedAt are timestamptz `Date`s in the
// DB; the mappers serialize them to ISO strings so the JSON/API contract stays
// string-typed for the client.
export interface OrderWithItems extends Omit<SelectOrder, "createdAt" | "updatedAt"> {
  createdAt: string;
  updatedAt: string;
  items: OrderItemResponse[];
}

export type OrderItemResponse = SelectOrderItem;

export interface MarketEventResponse extends Omit<SelectMarketEvent, "createdAt"> {
  createdAt: string;
}

export interface MarketSaleResponse extends Omit<SelectMarketSale, "createdAt"> {
  createdAt: string;
}

export interface ExpenseResponse extends Omit<SelectExpense, "createdAt"> {
  createdAt: string;
}

export type CompanyProfileResponse = SelectCompanyProfile;

export interface SubscriptionInfo {
  status: "trial" | "active" | "expired" | "cancelled";
  isActive: boolean;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  daysRemaining: number | null;
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
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items,
  };
}

export interface PageOpts {
  limit?: number;
  offset?: number;
}

export async function getOrders(userId: string, opts?: PageOpts): Promise<OrderWithItems[]> {
  let q = db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(sql`${orders.createdAt} DESC`)
    .$dynamic();
  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);
  const rows = await q;

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
    paidAt?: string;
    paymentMethod?: string;
    shippingCost?: number;
    processingStatus?: string;
    comment?: string;
    items: { name: string; quantity: number; price: number; processingStatus?: string; comment?: string }[];
  }
): Promise<OrderWithItems> {
  // Orders no longer consume an invoice number at creation — the counter is the
  // authoritative sequence for *issued* invoices (Phase 2.1/2.2). An order is a
  // working document; its legal number is assigned when an invoice is issued.
  // All amounts are integer cents — pure integer arithmetic, no floats.
  const total = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

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
      invoiceNumber: "",
      notes: data.notes,
      orderDate: data.orderDate || today,
      serviceDate: data.serviceDate || null,
      // Zuflussdatum: übernommen falls angegeben, sonst heute bei bezahltem Status.
      paidAt: data.paidAt || (isPaidLike(data.status) ? today : null),
      paymentMethod: data.paymentMethod || null,
      shippingCost: data.shippingCost ?? null,
      total,
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
              price: item.price,
              processingStatus: item.processingStatus,
              comment: item.comment,
            }))
          )
          .returning()
      : [];

  return buildOrderWithItems(order, insertedItems);
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
    paidAt?: string;
    paymentMethod?: string;
    shippingCost?: number;
    processingStatus?: string;
    comment?: string;
    items?: { id?: string; name: string; quantity: number; price: number; processingStatus?: string; comment?: string }[];
  }
): Promise<OrderWithItems | undefined> {
  const existing = await getOrder(userId, id);
  if (!existing) return undefined;

  const { items: newItems, ...fields } = updates;
  const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };

  if (fields.customerName !== undefined) dbUpdates.customerName = fields.customerName;
  if (fields.customerEmail !== undefined) dbUpdates.customerEmail = fields.customerEmail;
  if (fields.customerStreet !== undefined) dbUpdates.customerStreet = fields.customerStreet;
  if (fields.customerZip !== undefined) dbUpdates.customerZip = fields.customerZip;
  if (fields.customerCity !== undefined) dbUpdates.customerCity = fields.customerCity;
  if (fields.customerCountry !== undefined) dbUpdates.customerCountry = fields.customerCountry;
  if (fields.status !== undefined) dbUpdates.status = fields.status;
  if (fields.notes !== undefined) dbUpdates.notes = fields.notes;
  if (fields.orderDate !== undefined) dbUpdates.orderDate = fields.orderDate;
  if (fields.serviceDate !== undefined) dbUpdates.serviceDate = fields.serviceDate || null;
  if (fields.paidAt !== undefined) dbUpdates.paidAt = fields.paidAt || null;
  if (fields.paymentMethod !== undefined) dbUpdates.paymentMethod = fields.paymentMethod || null;
  if (fields.shippingCost !== undefined) dbUpdates.shippingCost = fields.shippingCost;
  if (fields.processingStatus !== undefined) dbUpdates.processingStatus = fields.processingStatus;
  if (fields.comment !== undefined) dbUpdates.comment = fields.comment;

  // Auto-set the inflow date when an order first moves into a paid-like status
  // (unless the caller supplied one explicitly).
  if (
    fields.status !== undefined &&
    isPaidLike(fields.status) &&
    !existing.paidAt &&
    fields.paidAt === undefined
  ) {
    dbUpdates.paidAt = new Date().toISOString().slice(0, 10);
  }

  // Wrap item replacement + order update in a transaction to prevent data loss
  await db.transaction(async (tx) => {
    if (newItems) {
      const total = newItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      dbUpdates.total = total;
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      if (newItems.length > 0) {
        await tx.insert(orderItems).values(
          newItems.map((item) => ({
            orderId: id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            processingStatus: item.processingStatus,
            comment: item.comment,
          }))
        );
      }
    }

    await tx.update(orders).set(dbUpdates).where(and(eq(orders.id, id), eq(orders.userId, userId)));
  });

  return getOrder(userId, id);
}

export async function deleteOrder(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db.delete(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))).returning({ id: orders.id });
  return !!deleted;
}

// ── Markets ────────────────────────────────────────────────

function toMarketResponse(m: SelectMarketEvent): MarketEventResponse {
  return { ...m, createdAt: m.createdAt.toISOString() };
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

// Drizzle transaction handle type (first arg of the db.transaction callback).
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Keeps the derived expense rows for a market's stand fee / travel cost in sync
 * (source `market_fee` / `market_travel`). Delete-and-reinsert inside the caller's
 * transaction so market costs land in the expenses table exactly once — this is
 * what makes them show up correctly in the dashboard/EÜR.
 */
async function syncMarketExpenses(
  tx: DbTransaction,
  userId: string,
  marketId: string,
  market: { name: string; date: string; standFee: number; travelCost: number }
): Promise<void> {
  await tx
    .delete(expenses)
    .where(and(eq(expenses.marketId, marketId), inArray(expenses.source, ["market_fee", "market_travel"])));

  const rows = deriveMarketCosts(market).map((r) => ({ ...r, userId, marketId }));
  if (rows.length > 0) await tx.insert(expenses).values(rows);
}

export async function createMarket(
  userId: string,
  data: { name: string; date: string; location: string; standFee: number; travelCost: number; notes: string; status?: string; quickItems?: { name: string; price: number }[] }
): Promise<MarketEventResponse> {
  const market = await db.transaction(async (tx) => {
    const [m] = await tx
      .insert(marketEvents)
      .values({
        userId,
        name: data.name,
        date: data.date,
        location: data.location,
        standFee: data.standFee,
        travelCost: data.travelCost,
        notes: data.notes,
        status: data.status || "open",
        quickItems: data.quickItems,
        createdAt: new Date(),
      })
      .returning();
    await syncMarketExpenses(tx, userId, m.id, {
      name: m.name,
      date: m.date,
      standFee: data.standFee,
      travelCost: data.travelCost,
    });
    return m;
  });
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
  if (updates.standFee !== undefined) dbUpdates.standFee = updates.standFee;
  if (updates.travelCost !== undefined) dbUpdates.travelCost = updates.travelCost;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.quickItems !== undefined) dbUpdates.quickItems = updates.quickItems;

  await db.transaction(async (tx) => {
    if (Object.keys(dbUpdates).length > 0) {
      await tx.update(marketEvents).set(dbUpdates).where(and(eq(marketEvents.id, id), eq(marketEvents.userId, userId)));
    }
    // Re-derive the linked cost expenses from the merged values.
    await syncMarketExpenses(tx, userId, id, {
      name: updates.name ?? existing.name,
      date: updates.date ?? existing.date,
      standFee: updates.standFee ?? existing.standFee,
      travelCost: updates.travelCost ?? existing.travelCost,
    });
  });
  return getMarket(userId, id);
}

export async function deleteMarket(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db.delete(marketEvents).where(and(eq(marketEvents.id, id), eq(marketEvents.userId, userId))).returning({ id: marketEvents.id });
  return !!deleted;
}

// ── Market Sales ───────────────────────────────────────────

function toSaleResponse(s: SelectMarketSale): MarketSaleResponse {
  return { ...s, createdAt: s.createdAt.toISOString() };
}

export async function getMarketSales(userId: string, marketId: string): Promise<MarketSaleResponse[]> {
  const rows = await db
    .select()
    .from(marketSales)
    .where(and(eq(marketSales.userId, userId), eq(marketSales.marketId, marketId)))
    .orderBy(sql`${marketSales.createdAt} DESC`);
  return rows.map(toSaleResponse);
}

export async function getAllMarketSales(userId: string, opts?: PageOpts): Promise<MarketSaleResponse[]> {
  let q = db
    .select()
    .from(marketSales)
    .where(eq(marketSales.userId, userId))
    .orderBy(sql`${marketSales.createdAt} DESC`)
    .$dynamic();
  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);
  const rows = await q;
  return rows.map(toSaleResponse);
}

export async function createMarketSale(
  userId: string,
  data: { marketId: string; description: string; amount: number; quantity: number }
): Promise<MarketSaleResponse> {
  const [sale] = await db
    .insert(marketSales)
    .values({
      userId,
      marketId: data.marketId,
      description: data.description,
      amount: data.amount,
      quantity: data.quantity,
      createdAt: new Date(),
    })
    .returning();
  return toSaleResponse(sale);
}

export async function deleteMarketSale(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db.delete(marketSales).where(and(eq(marketSales.id, id), eq(marketSales.userId, userId))).returning({ id: marketSales.id });
  return !!deleted;
}

// ── Expenses ───────────────────────────────────────────────

function toExpenseResponse(e: SelectExpense): ExpenseResponse {
  return { ...e, createdAt: e.createdAt.toISOString() };
}

// Manual expenses only — market cost rows (source market_fee/market_travel)
// are managed via the market form and hidden from the expenses list.
export async function getExpenses(userId: string, opts?: PageOpts): Promise<ExpenseResponse[]> {
  let q = db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, userId), eq(expenses.source, "manual")))
    .orderBy(sql`${expenses.createdAt} DESC`)
    .$dynamic();
  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);
  const rows = await q;
  return rows.map(toExpenseResponse);
}

// All expense rows incl. derived market costs — for dashboard/EÜR aggregation.
export async function getReportingExpenses(userId: string): Promise<ExpenseResponse[]> {
  const rows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .orderBy(sql`${expenses.expenseDate} DESC`);
  return rows.map(toExpenseResponse);
}

export async function createExpense(
  userId: string,
  data: { description: string; amount: number; category: string; expenseDate: string }
): Promise<ExpenseResponse> {
  const now = new Date();
  const [expense] = await db
    .insert(expenses)
    .values({
      userId,
      description: data.description,
      amount: data.amount,
      category: data.category,
      expenseDate: data.expenseDate || now.toISOString().slice(0, 10),
      createdAt: now,
    })
    .returning();
  return toExpenseResponse(expense);
}

export async function deleteExpense(userId: string, id: string): Promise<boolean> {
  const [deleted] = await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).returning({ id: expenses.id });
  return !!deleted;
}

// ── Profile ────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<CompanyProfileResponse> {
  const [profile] = await db.select().from(companyProfiles).where(eq(companyProfiles.userId, userId));
  if (profile) return profile;
  return { id: "", userId, name: "", address: "", email: "", phone: "", taxNote: "", smallBusinessNote: null, isSmallBusiness: true, defaultShippingCost: null };
}

export async function upsertProfile(
  userId: string,
  data: { name: string; address: string; email: string; phone: string; taxNote: string; smallBusinessNote?: string; isSmallBusiness?: boolean; defaultShippingCost?: number }
): Promise<CompanyProfileResponse> {
  const values = {
    name: data.name,
    address: data.address,
    email: data.email,
    phone: data.phone,
    taxNote: data.taxNote,
    smallBusinessNote: data.smallBusinessNote,
    isSmallBusiness: data.isSmallBusiness ?? true,
    defaultShippingCost: data.defaultShippingCost ?? null,
  };
  const [profile] = await db
    .insert(companyProfiles)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: companyProfiles.userId, set: values })
    .returning();
  return profile;
}

// ── Invoice Counter ────────────────────────────────────────

export async function getInvoiceCounter(userId: string): Promise<number> {
  const [row] = await db
    .select()
    .from(invoiceCounters)
    .where(eq(invoiceCounters.userId, userId));
  return row?.counter ?? 0;
}

export async function setInvoiceCounter(userId: string, counter: number): Promise<void> {
  await db
    .insert(invoiceCounters)
    .values({ userId, counter })
    .onConflictDoUpdate({
      target: invoiceCounters.userId,
      set: { counter },
    });
}

export async function getNextInvoiceNumber(
  userId: string,
  txOrDb: Pick<typeof db, "insert"> = db
): Promise<string> {
  const [result] = await txOrDb
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

// ── Invoices (immutable GoBD documents) ──────────────────────

export interface InvoiceResponse extends Omit<SelectInvoice, "createdAt" | "archivedAt"> {
  createdAt: string;
  archivedAt: string | null;
}

function toInvoiceResponse(inv: SelectInvoice): InvoiceResponse {
  return {
    ...inv,
    createdAt: inv.createdAt.toISOString(),
    archivedAt: inv.archivedAt ? inv.archivedAt.toISOString() : null,
  };
}

/** Map an immutable snapshot to DB insert values. `status` is always 'issued'
 *  — even a cancellation invoice is itself a valid issued document. */
function snapshotToInsert(
  userId: string,
  orderId: string | null,
  s: InvoiceSnapshot
): typeof invoices.$inferInsert {
  return {
    userId,
    orderId,
    invoiceNumber: s.invoiceNumber,
    type: s.type,
    status: "issued",
    cancelsInvoiceId: s.cancelsInvoiceId,
    issueDate: s.issueDate,
    serviceDate: s.serviceDate,
    sellerName: s.seller.name,
    sellerAddress: s.seller.address,
    sellerEmail: s.seller.email,
    sellerPhone: s.seller.phone,
    customerName: s.customer.name,
    customerEmail: s.customer.email,
    customerStreet: s.customer.street,
    customerZip: s.customer.zip,
    customerCity: s.customer.city,
    customerCountry: s.customer.country,
    items: s.items,
    subtotal: s.subtotal,
    shippingCost: s.shippingCost,
    total: s.total,
    taxNote: s.taxNote,
    isSmallBusiness: s.isSmallBusiness,
    notes: s.notes,
  };
}

function invoiceRowToSnapshot(row: SelectInvoice): InvoiceSnapshot {
  return {
    type: row.type as InvoiceType,
    invoiceNumber: row.invoiceNumber,
    issueDate: row.issueDate,
    serviceDate: row.serviceDate,
    cancelsInvoiceId: row.cancelsInvoiceId,
    seller: {
      name: row.sellerName,
      address: row.sellerAddress,
      email: row.sellerEmail,
      phone: row.sellerPhone,
    },
    customer: {
      name: row.customerName,
      email: row.customerEmail,
      street: row.customerStreet,
      zip: row.customerZip,
      city: row.customerCity,
      country: row.customerCountry,
    },
    items: row.items,
    subtotal: row.subtotal,
    shippingCost: row.shippingCost,
    total: row.total,
    taxNote: row.taxNote,
    isSmallBusiness: row.isSmallBusiness,
    notes: row.notes,
  };
}

export async function getInvoices(userId: string, opts?: PageOpts): Promise<InvoiceResponse[]> {
  let q = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, userId), isNull(invoices.archivedAt)))
    .orderBy(sql`${invoices.createdAt} DESC`)
    .$dynamic();
  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);
  const rows = await q;
  return rows.map(toInvoiceResponse);
}

export async function getInvoice(userId: string, id: string): Promise<InvoiceResponse | undefined> {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId), isNull(invoices.archivedAt)));
  return inv ? toInvoiceResponse(inv) : undefined;
}

export type IssueInvoiceResult =
  | { ok: true; invoice: InvoiceResponse }
  | { ok: false; code: "order_not_found" | "already_issued" };

/**
 * Issue an immutable invoice for an order: freeze a snapshot of seller, recipient,
 * positions, amounts and tax notice, and consume the next invoice number. At most
 * one active (issued) invoice per order — re-issuance after a Storno is allowed.
 */
export async function issueInvoice(userId: string, orderId: string): Promise<IssueInvoiceResult> {
  const order = await getOrder(userId, orderId);
  if (!order) return { ok: false, code: "order_not_found" };

  const [existing] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.orderId, orderId),
        eq(invoices.type, "invoice"),
        eq(invoices.status, "issued")
      )
    );
  if (existing) return { ok: false, code: "already_issued" };

  const profile = await getProfile(userId);
  const today = new Date().toISOString().slice(0, 10);

  const row = await db.transaction(async (tx) => {
    const invoiceNumber = await getNextInvoiceNumber(userId, tx);
    const snapshot = buildInvoiceSnapshot({
      invoiceNumber,
      issueDate: today,
      order: {
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerStreet: order.customerStreet,
        customerZip: order.customerZip,
        customerCity: order.customerCity,
        customerCountry: order.customerCountry,
        serviceDate: order.serviceDate,
        shippingCost: order.shippingCost,
        notes: order.notes,
      },
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
      profile: profile.id ? profile : null,
    });
    const [inserted] = await tx.insert(invoices).values(snapshotToInsert(userId, orderId, snapshot)).returning();
    return inserted;
  });

  return { ok: true, invoice: toInvoiceResponse(row) };
}

export type CancelInvoiceResult =
  | { ok: true; cancellation: InvoiceResponse; original: InvoiceResponse }
  | { ok: false; code: "not_found" | "not_cancellable" };

/**
 * Cancel an issued invoice via a Storno: insert a cancellation invoice (negated
 * amounts, its own number, reference to the original) and flip the original's
 * status to 'cancelled'. A cancellation or already-cancelled invoice cannot be
 * cancelled again.
 */
export async function cancelInvoice(userId: string, invoiceId: string): Promise<CancelInvoiceResult> {
  const [original] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)));
  if (!original) return { ok: false, code: "not_found" };
  if (original.type !== "invoice" || original.status !== "issued") {
    return { ok: false, code: "not_cancellable" };
  }

  const today = new Date().toISOString().slice(0, 10);

  const result = await db.transaction(async (tx) => {
    const invoiceNumber = await getNextInvoiceNumber(userId, tx);
    const cancellation = buildCancellationSnapshot({
      invoiceNumber,
      issueDate: today,
      cancelsInvoiceId: original.id,
      original: invoiceRowToSnapshot(original),
    });
    const [cancellationRow] = await tx
      .insert(invoices)
      .values(snapshotToInsert(userId, original.orderId, cancellation))
      .returning();
    const [updatedOriginal] = await tx
      .update(invoices)
      .set({ status: "cancelled" })
      .where(and(eq(invoices.id, original.id), eq(invoices.userId, userId)))
      .returning();
    return { cancellationRow, updatedOriginal };
  });

  return {
    ok: true,
    cancellation: toInvoiceResponse(result.cancellationRow),
    original: toInvoiceResponse(result.updatedOriginal),
  };
}

/**
 * DSGVO/GoBD retention on account deletion: decouple the user's invoices from
 * the account (userId → null) and stamp the statutory retention deadline. The
 * immutable snapshot is kept intact; nothing is deleted. Idempotent — only
 * touches not-yet-archived rows.
 */
export async function archiveUserInvoices(
  userId: string,
  txOrDb: Pick<typeof db, "select" | "update"> = db
): Promise<void> {
  const rows = await txOrDb
    .select({ id: invoices.id, issueDate: invoices.issueDate })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), isNull(invoices.archivedAt)));
  const archivedAt = new Date();
  for (const row of rows) {
    await txOrDb
      .update(invoices)
      .set({ archivedAt, retentionUntil: computeRetentionUntil(row.issueDate), userId: null })
      .where(eq(invoices.id, row.id));
  }
}

// ── Delete All User Data (for backup restore or account deletion) ────────────

export async function deleteAllUserData(userId: string, txOrDb: Pick<typeof db, "delete" | "select"> = db): Promise<void> {
  // Delete in correct order due to foreign keys
  // market_sales → references market_events
  await txOrDb.delete(marketSales).where(eq(marketSales.userId, userId));
  // order_items → references orders (cascade handles this, but explicit is safer)
  const userOrders = await txOrDb.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId));
  if (userOrders.length > 0) {
    await txOrDb.delete(orderItems).where(inArray(orderItems.orderId, userOrders.map(o => o.id)));
  }
  // NOTE: invoices are intentionally NOT deleted here. Statutory retention
  // (§147 AO / §14b UStG) requires keeping issued invoices ~10 years, so account
  // deletion *archives* them via archiveUserInvoices() instead. When orders are
  // deleted below, an archived invoice's orderId is set null (FK), snapshot kept.
  await txOrDb.delete(orders).where(eq(orders.userId, userId));
  await txOrDb.delete(marketEvents).where(eq(marketEvents.userId, userId));
  await txOrDb.delete(expenses).where(eq(expenses.userId, userId));
  await txOrDb.delete(companyProfiles).where(eq(companyProfiles.userId, userId));
  await txOrDb.delete(invoiceCounters).where(eq(invoiceCounters.userId, userId));
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
