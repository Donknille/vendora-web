import "server-only";
import { eq, and, sql, inArray, isNull, isNotNull, lt } from "drizzle-orm";
import { planMarketCostRows, type MarketCostSource } from "@/lib/marketCosts";
import { isPaidLike } from "@/lib/orderStatus";
// Alias, weil mehrere Funktionen hier eine lokale Konstante `today` fuehren.
import { isoDay, today as todayIso } from "@/lib/date";
import { pickDefined, emptyToNull } from "@/lib/pickDefined";
import { getEffectivePlan, canCreate, daysLeft, type Plan } from "@/lib/plan";
import {
  buildInvoiceSnapshot,
  buildCancellationSnapshot,
  computeInvoiceTotals,
  computeRetentionUntil,
  isInvoiceReadyProfile,
  type InvoiceSnapshot,
  type InvoiceType,
} from "@/lib/invoice";
import { db } from "./db";
import {
  users,
  orders,
  orderItems,
  customers,
  marketEvents,
  marketSales,
  expenses,
  companyProfiles,
  invoiceCounters,
  invoices,
  euerExports,
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

// Plan status returned by /api/subscription (Phase 4).
export interface SubscriptionInfo {
  plan: Plan; // "free" (read-only) | "trial" | "pro"
  canCreate: boolean; // false = read-only (FREE)
  proActive: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number | null; // whole days left if in trial, else null
  expiresAt: string | null; // PRO subscription paid-through date, if any
}

// ── Users ──────────────────────────────────────────────────

export async function getUser(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

/** Ob die Willkommens-Erklaerung fuer dieses Konto schon abgeschlossen wurde. */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ onboardedAt: users.onboardedAt })
    .from(users)
    .where(eq(users.id, userId));
  return row?.onboardedAt != null;
}

/**
 * Haelt fest, dass die Erklaerung durch ist.
 *
 * Das `isNull` macht den Aufruf idempotent: ein zweiter Versuch — etwa weil der
 * erste ohne Netz verlorenging — laesst den urspruenglichen Zeitpunkt stehen,
 * statt ihn nach vorn zu schieben.
 */
export async function markOnboardingComplete(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ onboardedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.onboardedAt)));
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
  // All amounts are integer cents — pure integer arithmetic, no floats. The stored
  // total is computed with the same helper the invoice uses, so an order and the
  // invoice issued from it can never disagree: line items + shipping.
  const shippingCost = data.shippingCost ?? null;
  const { total } = computeInvoiceTotals(data.items, shippingCost ?? 0);
  const now = new Date();
  const today = isoDay(now);

  // Link (or create) the customer master record for autocomplete.
  const customerId = await upsertCustomerFromOrder(userId, {
    name: data.customerName,
    email: data.customerEmail,
    street: data.customerStreet,
    zip: data.customerZip,
    city: data.customerCity,
    country: data.customerCountry || "",
  });

  const [order] = await db
    .insert(orders)
    .values({
      userId,
      customerId,
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
      shippingCost,
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
  const dbUpdates: Record<string, unknown> = {
    updatedAt: new Date(),
    ...pickDefined(fields, [
      "customerName",
      "customerEmail",
      "customerStreet",
      "customerZip",
      "customerCity",
      "customerCountry",
      "status",
      "notes",
      "orderDate",
      "shippingCost",
      "processingStatus",
      "comment",
    ]),
  };

  // Diese drei sind loeschbar: ein geleertes Formularfeld kommt als "" an und
  // muss in der Spalte NULL werden, nicht ein leerer String.
  if (fields.serviceDate !== undefined) dbUpdates.serviceDate = emptyToNull(fields.serviceDate);
  if (fields.paidAt !== undefined) dbUpdates.paidAt = emptyToNull(fields.paidAt);
  if (fields.paymentMethod !== undefined) dbUpdates.paymentMethod = emptyToNull(fields.paymentMethod);

  // Auto-set the inflow date when an order first moves into a paid-like status
  // (unless the caller supplied one explicitly).
  if (
    fields.status !== undefined &&
    isPaidLike(fields.status) &&
    !existing.paidAt &&
    fields.paidAt === undefined
  ) {
    dbUpdates.paidAt = todayIso();
  }

  // Re-link the customer master record when the recipient snapshot changes.
  if (
    fields.customerName !== undefined ||
    fields.customerEmail !== undefined ||
    fields.customerStreet !== undefined ||
    fields.customerZip !== undefined ||
    fields.customerCity !== undefined ||
    fields.customerCountry !== undefined
  ) {
    dbUpdates.customerId = await upsertCustomerFromOrder(userId, {
      name: fields.customerName ?? existing.customerName,
      email: fields.customerEmail ?? existing.customerEmail,
      street: fields.customerStreet ?? existing.customerStreet,
      zip: fields.customerZip ?? existing.customerZip,
      city: fields.customerCity ?? existing.customerCity,
      country: fields.customerCountry ?? existing.customerCountry,
    });
  }

  // The stored total is line items + shipping, so it has to be recomputed whenever
  // either side changes — including a shipping-only edit that leaves the items alone.
  if (newItems || fields.shippingCost !== undefined) {
    const effectiveItems = newItems ?? existing.items;
    const effectiveShipping = fields.shippingCost ?? existing.shippingCost ?? 0;
    dbUpdates.total = computeInvoiceTotals(effectiveItems, effectiveShipping).total;
  }

  // Wrap item replacement + order update in a transaction to prevent data loss
  await db.transaction(async (tx) => {
    if (newItems) {
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

// ── Customers ──────────────────────────────────────────────

export interface CustomerResponse {
  id: string;
  name: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

export async function getCustomers(userId: string): Promise<CustomerResponse[]> {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      street: customers.street,
      zip: customers.zip,
      city: customers.city,
      country: customers.country,
    })
    .from(customers)
    .where(eq(customers.userId, userId))
    .orderBy(sql`${customers.updatedAt} DESC`)
    .limit(200);
}

type CustomerFields = { name: string; email: string; street: string; zip: string; city: string; country: string };

/**
 * Find or create the customer master record matching an order's recipient
 * snapshot; returns the customer id (or null for an empty recipient). Exact-match
 * dedup keeps it predictable — a changed address just yields a new customer row.
 */
async function upsertCustomerFromOrder(
  userId: string,
  r: CustomerFields,
  txOrDb: Pick<typeof db, "select" | "insert"> = db
): Promise<string | null> {
  if (!r.name.trim()) return null;
  const [existing] = await txOrDb
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.userId, userId),
        eq(customers.name, r.name),
        eq(customers.email, r.email),
        eq(customers.street, r.street),
        eq(customers.zip, r.zip),
        eq(customers.city, r.city),
        eq(customers.country, r.country)
      )
    );
  if (existing) return existing.id;
  const [created] = await txOrDb
    .insert(customers)
    .values({
      userId,
      name: r.name,
      email: r.email,
      street: r.street,
      zip: r.zip,
      city: r.city,
      country: r.country,
    })
    .returning({ id: customers.id });
  return created.id;
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
 *
 * Runs on every create/update, so the status gate maintains itself: a market
 * moved to "cancelled" derives no rows and the delete alone releases its costs.
 */
async function syncMarketExpenses(
  tx: DbTransaction,
  userId: string,
  marketId: string,
  market: MarketCostSource
): Promise<void> {
  await tx
    .delete(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        eq(expenses.marketId, marketId),
        inArray(expenses.source, ["market_fee", "market_travel"])
      )
    );

  const rows = planMarketCostRows(market, { userId, marketId });
  if (rows.length > 0) await tx.insert(expenses).values(rows);
}

export async function createMarket(
  userId: string,
  data: { name: string; date: string; location: string; standFee: number; travelCost: number; notes: string; status?: string; applicationDeadline?: string | null; quickItems?: { name: string; price: number }[] }
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
        applicationDeadline: data.applicationDeadline || null,
        quickItems: data.quickItems,
        createdAt: new Date(),
      })
      .returning();
    await syncMarketExpenses(tx, userId, m.id, {
      name: m.name,
      date: m.date,
      standFee: data.standFee,
      travelCost: data.travelCost,
      status: m.status, // aus der eingefuegten Zeile, damit der DB-Default greift
    });
    return m;
  });
  return toMarketResponse(market);
}

export async function updateMarket(
  userId: string,
  id: string,
  updates: Partial<{ name: string; date: string; location: string; standFee: number; travelCost: number; notes: string; status: string; applicationDeadline: string | null; quickItems: { name: string; price: number }[] }>
): Promise<MarketEventResponse | undefined> {
  const existing = await getMarket(userId, id);
  if (!existing) return undefined;

  // Bleibt leer, wenn nichts gesetzt wurde — das UPDATE unten entfaellt dann,
  // die Marktkosten werden aber trotzdem neu abgeleitet.
  const dbUpdates: Record<string, unknown> = pickDefined(updates, [
    "name",
    "date",
    "location",
    "standFee",
    "travelCost",
    "notes",
    "status",
    "quickItems",
  ]);

  // Die Bewerbungsfrist ist loeschbar: "" muss in der Spalte NULL werden.
  if (updates.applicationDeadline !== undefined) {
    dbUpdates.applicationDeadline = emptyToNull(updates.applicationDeadline);
  }

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
      status: updates.status ?? existing.status,
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

export interface MarketSaleBatchEntry {
  clientId: string;
  description: string;
  amount: number;
  quantity: number;
  paymentMethod?: "cash" | "card" | null;
  createdAt?: string; // ISO string; the moment the sale was recorded (offline)
}

/**
 * Idempotently persists a batch of offline-queued sales (Phase 3.2). Each entry
 * carries a client-generated `clientId`; the scoped-unique index
 * (user_id, client_id) makes a re-synced sale insert exactly once. Returns the
 * authoritative server rows for every requested clientId (freshly inserted AND
 * pre-existing) so the client can clear its queue and reconcile.
 */
export async function upsertMarketSalesBatch(
  userId: string,
  marketId: string,
  entries: MarketSaleBatchEntry[]
): Promise<MarketSaleResponse[]> {
  if (entries.length === 0) return [];

  // Dedup within the batch: a single INSERT ... ON CONFLICT DO NOTHING cannot
  // touch the same (user_id, client_id) twice, so collapse duplicate clientIds.
  const byClientId = new Map<string, MarketSaleBatchEntry>();
  for (const e of entries) if (!byClientId.has(e.clientId)) byClientId.set(e.clientId, e);

  const values = [...byClientId.values()].map((e) => ({
    userId,
    marketId,
    clientId: e.clientId,
    description: e.description,
    amount: e.amount,
    quantity: e.quantity,
    paymentMethod: e.paymentMethod ?? null,
    createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
  }));

  await db
    .insert(marketSales)
    .values(values)
    .onConflictDoNothing({ target: [marketSales.userId, marketSales.clientId] });

  const clientIds = [...byClientId.keys()];
  const rows = await db
    .select()
    .from(marketSales)
    .where(
      and(
        eq(marketSales.userId, userId),
        eq(marketSales.marketId, marketId),
        inArray(marketSales.clientId, clientIds)
      )
    );
  return rows.map(toSaleResponse);
}

// ── Expenses ───────────────────────────────────────────────

function toExpenseResponse(e: SelectExpense): ExpenseResponse {
  return { ...e, createdAt: e.createdAt.toISOString() };
}

export interface ExpenseQueryOpts extends PageOpts {
  /**
   * `"manual"` restricts the result to hand-entered rows — only the backup
   * export needs that (the restore re-derives market costs from the markets,
   * so exporting them too would double-book on import).
   */
  source?: "manual" | "all";
}

/**
 * Expenses of a user, newest receipt first.
 *
 * Without `opts` this returns **every** row incl. the derived market cost rows
 * and is not paginated — that is the reporting path (dashboard, EÜR), where a
 * cap would silently truncate the totals.
 *
 * Ordered by `expense_date`, not `created_at`: a derived row carries the market
 * day as its receipt date while its `created_at` only says when the market was
 * last edited, which would scatter those rows randomly through the list.
 */
export async function getExpenses(userId: string, opts?: ExpenseQueryOpts): Promise<ExpenseResponse[]> {
  const where =
    opts?.source === "manual"
      ? and(eq(expenses.userId, userId), eq(expenses.source, "manual"))
      : eq(expenses.userId, userId);
  let q = db
    .select()
    .from(expenses)
    .where(where)
    .orderBy(sql`${expenses.expenseDate} DESC, ${expenses.createdAt} DESC`)
    .$dynamic();
  if (opts?.limit != null) q = q.limit(opts.limit);
  if (opts?.offset != null) q = q.offset(opts.offset);
  const rows = await q;
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
      expenseDate: data.expenseDate || isoDay(now),
      createdAt: now,
    })
    .returning();
  return toExpenseResponse(expense);
}

export type DeleteExpenseResult = "deleted" | "not_found" | "derived";

/**
 * Only manual rows can be deleted. Market cost rows are owned by their market —
 * deleting one here would make it reappear on the next market edit, so the
 * caller gets `"derived"` and the UI points at the market instead. A UI-only
 * guard is not enough: the ids are visible in the dashboard payload.
 */
export async function deleteExpense(userId: string, id: string): Promise<DeleteExpenseResult> {
  const [deleted] = await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId), eq(expenses.source, "manual")))
    .returning({ id: expenses.id });
  if (deleted) return "deleted";

  // Nothing deleted: tell "does not exist" apart from "is derived".
  const [existing] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  return existing ? "derived" : "not_found";
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
  | { ok: false; code: "order_not_found" | "already_issued" | "profile_incomplete" };

/**
 * Issue an immutable invoice for an order: freeze a snapshot of seller, recipient,
 * positions, amounts and tax notice, and consume the next invoice number. At most
 * one active (issued) invoice per order — re-issuance after a Storno is allowed.
 *
 * Fails closed without a seller: § 14 Abs. 4 UStG requires the full name and
 * address of the issuer. Whoever never opened the settings used to get an invoice
 * with an empty sender — and since the snapshot is immutable, the only way to
 * repair it afterwards is a cancellation invoice.
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
  if (!isInvoiceReadyProfile(profile)) return { ok: false, code: "profile_incomplete" };

  const today = todayIso();

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

  const today = todayIso();

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

/**
 * Löscht archivierte Rechnungen, deren Aufbewahrungsfrist abgelaufen ist.
 *
 * `archiveUserInvoices` stempelt die Frist beim Löschen des Kontos (31.12. des
 * Ausstellungsjahres + 10, § 147 Abs. 3 AO). Ausgewertet wurde sie bisher
 * nirgends — die Datenschutzerklärung sagt aber „und anschließend gelöscht" zu.
 * Diese Funktion macht die Zusage wahr; aufgerufen wird sie vom Cron-Endpunkt.
 *
 * Nur archivierte Belege sind betroffen: solange ein Konto existiert, gehören
 * seine Rechnungen ihm, unabhängig vom Alter.
 */
export async function purgeExpiredArchivedInvoices(
  today: string = todayIso()
): Promise<number> {
  const deleted = await db
    .delete(invoices)
    .where(
      and(
        isNotNull(invoices.archivedAt),
        isNotNull(invoices.retentionUntil),
        lt(invoices.retentionUntil, today)
      )
    )
    .returning({ id: invoices.id });
  return deleted.length;
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
  await txOrDb.delete(customers).where(eq(customers.userId, userId));
  await txOrDb.delete(marketEvents).where(eq(marketEvents.userId, userId));
  await txOrDb.delete(expenses).where(eq(expenses.userId, userId));
  await txOrDb.delete(companyProfiles).where(eq(companyProfiles.userId, userId));
  await txOrDb.delete(invoiceCounters).where(eq(invoiceCounters.userId, userId));
  await txOrDb.delete(euerExports).where(eq(euerExports.userId, userId));
}

// ── Subscription ───────────────────────────────────────────

export async function updateSubscription(
  userId: string,
  data: Partial<{ plan: Plan; subscriptionStatus: string; trialEndsAt: Date; subscriptionExpiresAt: Date; stripeCustomerId: string; stripeSubscriptionId: string }>
): Promise<void> {
  const updates = pickDefined(data, [
    "plan",
    "subscriptionStatus",
    "trialEndsAt",
    "subscriptionExpiresAt",
    "stripeCustomerId",
    "stripeSubscriptionId",
  ]);

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, userId));
  }
}

/** Effective plan for a user (PRO only while the subscription is paid through). */
export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await getUser(userId);
  return user ? getEffectivePlan(user) : "free";
}

/** Plan status for the /api/subscription endpoint. */
export async function getPlanInfo(userId: string): Promise<SubscriptionInfo | undefined> {
  const user = await getUser(userId);
  if (!user) return undefined;
  const plan = getEffectivePlan(user);
  return {
    plan,
    canCreate: canCreate(plan),
    proActive: plan === "pro",
    trialEndsAt: user.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft: plan === "trial" ? daysLeft(user.trialEndsAt) : null,
    expiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
  };
}

// ── EÜR export unlocks (per tax year) ──────────────────────

/** Marks a tax year as generated (idempotent) — called when a TRIAL/PRO user exports. */
export async function recordEuerExport(userId: string, year: number): Promise<void> {
  await db
    .insert(euerExports)
    .values({ userId, year })
    .onConflictDoNothing({ target: [euerExports.userId, euerExports.year] });
}

/** Whether the user has already generated the GuV export for this year. */
export async function hasEuerExport(userId: string, year: number): Promise<boolean> {
  const [row] = await db
    .select({ id: euerExports.id })
    .from(euerExports)
    .where(and(eq(euerExports.userId, userId), eq(euerExports.year, year)));
  return !!row;
}

/** Years the user has already unlocked by exporting (newest first). */
export async function getEuerExportYears(userId: string): Promise<number[]> {
  const rows = await db
    .select({ year: euerExports.year })
    .from(euerExports)
    .where(eq(euerExports.userId, userId))
    .orderBy(sql`${euerExports.year} DESC`);
  return rows.map((r) => r.year);
}
