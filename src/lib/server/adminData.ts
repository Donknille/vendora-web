import "server-only";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import {
  adminAuditLog,
  euerExports,
  expenses,
  invoices,
  marketEvents,
  marketSales,
  orders,
  users,
} from "./schema";
import { session } from "./auth-schema";
import { PRO_PRICE_CENTS, getEffectivePlan, type Plan } from "@/lib/plan";

/**
 * The ONLY data source the admin area is allowed to read from.
 *
 * Hard rule, enforced by `src/__tests__/adminDataBoundary.test.ts`: no route
 * under `src/app/api/admin/**` may query the business tables itself. Everything
 * it needs comes from here, and nothing here returns a monetary figure that
 * belongs to a user — not an order total, not an expense, not a market sale,
 * not an invoice amount, neither per user nor summed across the platform.
 *
 * Counting rows is fine ("this account has 14 orders"); reading what they are
 * worth is not. The platform operator administers accounts, they do not look
 * into their customers' books.
 *
 * The single monetary figure exposed here is the platform's OWN subscription
 * revenue, derived from the number of paying accounts times the list price —
 * never from user data.
 */

// ── Overview ────────────────────────────────────────────────

export type PlatformOverview = {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  expiredUsers: number;
  cancelledUsers: number;
  blockedUsers: number;
  deletedUsers: number;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${users.deletedAt} is null)`,
      active: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'active' and ${users.deletedAt} is null)`,
      trial: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'trial' and ${users.deletedAt} is null)`,
      expired: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'expired' and ${users.deletedAt} is null)`,
      cancelled: sql<number>`count(*) filter (where ${users.subscriptionStatus} = 'cancelled' and ${users.deletedAt} is null)`,
      blocked: sql<number>`count(*) filter (where ${users.isBlocked} = true and ${users.deletedAt} is null)`,
      deleted: sql<number>`count(*) filter (where ${users.deletedAt} is not null)`,
    })
    .from(users);

  return {
    totalUsers: Number(row.total),
    activeSubscriptions: Number(row.active),
    trialUsers: Number(row.trial),
    expiredUsers: Number(row.expired),
    cancelledUsers: Number(row.cancelled),
    blockedUsers: Number(row.blocked),
    deletedUsers: Number(row.deleted),
  };
}

// ── Growth over time ────────────────────────────────────────

export type GrowthPoint = { month: string; signups: number; cumulative: number };

/** Signups per calendar month for the last `months` months, plus a running total. */
export async function getGrowth(months = 12): Promise<GrowthPoint[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${users.createdAt}), 'YYYY-MM')`,
      signups: sql<number>`count(*)`,
    })
    .from(users)
    .where(
      sql`${users.createdAt} >= date_trunc('month', now()) - make_interval(months => ${months - 1})`
    )
    .groupBy(sql`date_trunc('month', ${users.createdAt})`)
    .orderBy(sql`date_trunc('month', ${users.createdAt})`);

  // Cumulative needs the accounts created before the window, too.
  const [{ before }] = await db
    .select({ before: sql<number>`count(*)` })
    .from(users)
    .where(
      sql`${users.createdAt} < date_trunc('month', now()) - make_interval(months => ${months - 1})`
    );

  let running = Number(before);
  return rows.map((r) => {
    running += Number(r.signups);
    return { month: r.month, signups: Number(r.signups), cumulative: running };
  });
}

// ── Trial → Pro conversion ──────────────────────────────────

export type Conversion = {
  trialRunning: number;
  converted: number;
  lapsed: number;
  /** converted / (converted + lapsed), null while no trial has ended yet. */
  conversionRate: number | null;
};

/**
 * Conversion is measured only over trials that have actually ended — a trial
 * still running is neither a win nor a loss and would otherwise drag the rate
 * down simply because the account is new.
 */
export async function getConversion(): Promise<Conversion> {
  const [row] = await db
    .select({
      running: sql<number>`count(*) filter (
        where ${users.trialEndsAt} > now()
          and ${users.subscriptionStatus} <> 'active'
          and ${users.deletedAt} is null)`,
      converted: sql<number>`count(*) filter (
        where ${users.subscriptionStatus} = 'active' and ${users.deletedAt} is null)`,
      lapsed: sql<number>`count(*) filter (
        where ${users.trialEndsAt} <= now()
          and ${users.subscriptionStatus} <> 'active'
          and ${users.deletedAt} is null)`,
    })
    .from(users);

  const converted = Number(row.converted);
  const lapsed = Number(row.lapsed);
  const decided = converted + lapsed;

  return {
    trialRunning: Number(row.running),
    converted,
    lapsed,
    conversionRate: decided === 0 ? null : converted / decided,
  };
}

// ── Activity ────────────────────────────────────────────────

export type Activity = {
  activeLast7Days: number;
  activeLast30Days: number;
  neverSignedIn: number;
};

/**
 * Activity is read from Better Auth sessions (`session.updatedAt`), which is the
 * closest thing to a "last seen" the schema has. It says when someone was
 * logged in, not what they did.
 */
export async function getActivity(): Promise<Activity> {
  const [row] = await db
    .select({
      d7: sql<number>`count(distinct ${session.userId}) filter (where ${session.updatedAt} >= now() - interval '7 days')`,
      d30: sql<number>`count(distinct ${session.userId}) filter (where ${session.updatedAt} >= now() - interval '30 days')`,
    })
    .from(session);

  const [{ withSession }] = await db
    .select({ withSession: sql<number>`count(distinct ${session.userId})` })
    .from(session);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(isNull(users.deletedAt));

  return {
    activeLast7Days: Number(row.d7),
    activeLast30Days: Number(row.d30),
    neverSignedIn: Math.max(0, Number(total) - Number(withSession)),
  };
}

// ── Feature adoption ────────────────────────────────────────

export type FeatureAdoption = {
  totalUsers: number;
  withOrders: number;
  withInvoices: number;
  withMarkets: number;
  withMarketSales: number;
  withExpenses: number;
  withEuerExport: number;
  emptyAccounts: number;
};

/**
 * How many accounts ever used a given feature — the most useful signal for
 * deciding what to improve. Distinct user counts only, never volumes or values.
 */
export async function getFeatureAdoption(): Promise<FeatureAdoption> {
  const distinctUsers = (table: typeof orders | typeof marketEvents | typeof marketSales | typeof expenses | typeof euerExports) =>
    db.select({ n: sql<number>`count(distinct user_id)` }).from(table);

  const [
    [{ total }],
    [{ n: ord }],
    [{ n: mk }],
    [{ n: ms }],
    [{ n: exp }],
    [{ n: euer }],
    [{ n: inv }],
  ] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(users).where(isNull(users.deletedAt)),
    distinctUsers(orders),
    distinctUsers(marketEvents),
    distinctUsers(marketSales),
    distinctUsers(expenses),
    distinctUsers(euerExports),
    db
      .select({ n: sql<number>`count(distinct ${invoices.userId})` })
      .from(invoices)
      .where(isNull(invoices.archivedAt)),
  ]);

  // Expressed as a WHERE clause rather than a FILTER aggregate: the correlated
  // subqueries did not bind to the outer row inside FILTER and counted every
  // account as empty.
  const [{ empty }] = await db
    .select({ empty: sql<number>`count(*)` })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        sql`not exists (select 1 from orders o where o.user_id = ${users.id})`,
        sql`not exists (select 1 from market_events m where m.user_id = ${users.id})`,
        sql`not exists (select 1 from expenses e where e.user_id = ${users.id})`
      )
    );

  return {
    totalUsers: Number(total),
    withOrders: Number(ord),
    withInvoices: Number(inv),
    withMarkets: Number(mk),
    withMarketSales: Number(ms),
    withExpenses: Number(exp),
    withEuerExport: Number(euer),
    emptyAccounts: Number(empty),
  };
}

// ── Platform revenue (the operator's own, never a user's) ────

export type PlatformRevenue = {
  payingAccounts: number;
  monthlyRecurringCents: number;
  pricePerAccountCents: number;
};

export async function getPlatformRevenue(): Promise<PlatformRevenue> {
  const [{ paying }] = await db
    .select({ paying: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.subscriptionStatus, "active"), isNull(users.deletedAt)));

  const payingAccounts = Number(paying);
  return {
    payingAccounts,
    monthlyRecurringCents: payingAccounts * PRO_PRICE_CENTS,
    pricePerAccountCents: PRO_PRICE_CENTS,
  };
}

// ── User list ───────────────────────────────────────────────

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: Date;
  plan: Plan;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  trialEndsAt: string | null;
  isBlocked: boolean;
  lastSeenAt: string | null;
  counts: { orders: number; markets: number; expenses: number };
};

export type ListUsersOptions = {
  search?: string;
  plan?: Plan;
  status?: string;
  blocked?: boolean;
  page?: number;
  pageSize?: number;
};

export type ListUsersResult = {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listUsers(opts: ListUsersOptions = {}): Promise<ListUsersResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

  const filters: SQL[] = [isNull(users.deletedAt)];
  if (opts.search) filters.push(sql`${users.email} ilike ${"%" + opts.search + "%"}`);
  if (opts.status) filters.push(eq(users.subscriptionStatus, opts.status));
  if (opts.blocked !== undefined) filters.push(eq(users.isBlocked, opts.blocked));

  const where = and(...filters);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(where);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      trialEndsAt: users.trialEndsAt,
      isBlocked: users.isBlocked,
      lastSeenAt: sql<Date | null>`(select max(s.updated_at) from "session" s where s.user_id = "users"."id")`,
      orderCount: sql<number>`(select count(*) from orders o where o.user_id = "users"."id")`,
      marketCount: sql<number>`(select count(*) from market_events m where m.user_id = "users"."id")`,
      expenseCount: sql<number>`(select count(*) from expenses e where e.user_id = "users"."id")`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const mapped = rows.map(toAdminUserRow);

  // Effective plan is computed in JS (date-dependent), so filter after mapping.
  const filtered = opts.plan ? mapped.filter((u) => u.plan === opts.plan) : mapped;

  return { users: filtered, total: Number(total), page, pageSize };
}

export async function getUserDetail(id: string): Promise<AdminUserRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionExpiresAt: users.subscriptionExpiresAt,
      trialEndsAt: users.trialEndsAt,
      isBlocked: users.isBlocked,
      lastSeenAt: sql<Date | null>`(select max(s.updated_at) from "session" s where s.user_id = "users"."id")`,
      orderCount: sql<number>`(select count(*) from orders o where o.user_id = "users"."id")`,
      marketCount: sql<number>`(select count(*) from market_events m where m.user_id = "users"."id")`,
      expenseCount: sql<number>`(select count(*) from expenses e where e.user_id = "users"."id")`,
    })
    .from(users)
    .where(eq(users.id, id));

  return row ? toAdminUserRow(row) : null;
}

type RawUserRow = {
  id: string;
  email: string;
  createdAt: Date;
  plan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
  trialEndsAt: Date | null;
  isBlocked: boolean | null;
  lastSeenAt: Date | string | null;
  orderCount: number;
  marketCount: number;
  expenseCount: number;
};

/** Explicit whitelist — the shape that leaves the server, nothing more. */
function toAdminUserRow(row: RawUserRow): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.createdAt,
    plan: getEffectivePlan(row),
    subscriptionStatus: row.subscriptionStatus,
    subscriptionExpiresAt: row.subscriptionExpiresAt?.toISOString() ?? null,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    isBlocked: row.isBlocked ?? false,
    lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
    counts: {
      orders: Number(row.orderCount),
      markets: Number(row.marketCount),
      expenses: Number(row.expenseCount),
    },
  };
}

// ── Audit log ───────────────────────────────────────────────

export type AuditAction =
  | "grant_pro"
  | "revoke_pro"
  | "extend_trial"
  | "block"
  | "unblock"
  | "delete_user";

export type AuditEntry = {
  id: string;
  actorEmail: string;
  action: AuditAction;
  targetUserId: string;
  targetEmail: string;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: string;
};

/**
 * Appends an audit entry. Accepts a transaction so the record and the change it
 * describes commit together — an action must never be able to succeed silently.
 */
export async function recordAdminAction(
  entry: {
    actorUserId: string;
    actorEmail: string;
    action: AuditAction;
    targetUserId: string;
    targetEmail: string;
    metadata?: Record<string, string | number | boolean>;
  },
  txOrDb: Pick<typeof db, "insert"> = db
): Promise<void> {
  await txOrDb.insert(adminAuditLog).values({
    actorUserId: entry.actorUserId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetUserId: entry.targetUserId,
    targetEmail: entry.targetEmail,
    metadata: entry.metadata ?? null,
  });
}

// ── Actions ─────────────────────────────────────────────────

export type AdminAction =
  | { action: "grant_pro"; days: number }
  | { action: "revoke_pro" }
  | { action: "extend_trial"; days: number }
  | { action: "block" }
  | { action: "unblock" }
  | { action: "delete_user" };

export type ApplyActionResult =
  | { ok: true; user: AdminUserRow | null }
  | { ok: false; reason: "not_found" | "stripe_failed" | "self_target" };

/**
 * Applies an administrative action and records it, both in one transaction, so
 * an account can never be changed without a trace. Deletion is the exception:
 * it runs its own transaction, so its audit entry is written afterwards.
 */
export async function applyAdminAction(
  actor: { userId: string; email: string },
  targetUserId: string,
  input: AdminAction
): Promise<ApplyActionResult> {
  const [target] = await db
    .select({ id: users.id, email: users.email, expiresAt: users.subscriptionExpiresAt, trialEndsAt: users.trialEndsAt })
    .from(users)
    .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)));

  if (!target) return { ok: false, reason: "not_found" };

  // Blocking or deleting yourself would lock the operator out of their own
  // platform; the UI hides it, the server refuses it.
  if (
    target.id === actor.userId &&
    (input.action === "block" || input.action === "delete_user")
  ) {
    return { ok: false, reason: "self_target" };
  }

  if (input.action === "delete_user") {
    const { deleteAccount } = await import("./accountDeletion");
    const result = await deleteAccount(targetUserId);
    if (!result.ok) return { ok: false, reason: result.reason };

    await recordAdminAction({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: "delete_user",
      targetUserId: target.id,
      targetEmail: target.email,
    });
    return { ok: true, user: null };
  }

  await db.transaction(async (tx) => {
    switch (input.action) {
      case "grant_pro": {
        // Extend from the later of now / the current expiry so granting twice
        // adds up instead of silently shortening an existing subscription.
        const base = new Date(
          Math.max(target.expiresAt?.getTime() ?? 0, Date.now())
        );
        base.setDate(base.getDate() + input.days);
        await tx
          .update(users)
          .set({ plan: "pro", subscriptionStatus: "active", subscriptionExpiresAt: base })
          .where(eq(users.id, targetUserId));
        break;
      }
      case "revoke_pro":
        await tx
          .update(users)
          .set({ plan: "free", subscriptionStatus: "cancelled" })
          .where(eq(users.id, targetUserId));
        break;
      case "extend_trial": {
        const base = new Date(
          Math.max(target.trialEndsAt?.getTime() ?? 0, Date.now())
        );
        base.setDate(base.getDate() + input.days);
        await tx
          .update(users)
          .set({ trialEndsAt: base, subscriptionStatus: "trial" })
          .where(eq(users.id, targetUserId));
        break;
      }
      case "block":
        await tx.update(users).set({ isBlocked: true }).where(eq(users.id, targetUserId));
        break;
      case "unblock":
        await tx.update(users).set({ isBlocked: false }).where(eq(users.id, targetUserId));
        break;
    }

    await recordAdminAction(
      {
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: input.action,
        targetUserId: target.id,
        targetEmail: target.email,
        metadata: "days" in input ? { days: input.days } : undefined,
      },
      tx
    );
  });

  return { ok: true, user: await getUserDetail(targetUserId) };
}

export async function listAuditLog(
  opts: { page?: number; pageSize?: number; targetUserId?: string } = {}
): Promise<{ entries: AuditEntry[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));

  const where = opts.targetUserId
    ? eq(adminAuditLog.targetUserId, opts.targetUserId)
    : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(adminAuditLog)
    .where(where);

  const rows = await db
    .select()
    .from(adminAuditLog)
    .where(where)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      actorEmail: r.actorEmail,
      action: r.action as AuditAction,
      targetUserId: r.targetUserId,
      targetEmail: r.targetEmail,
      metadata: r.metadata ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    total: Number(total),
    page,
    pageSize,
  };
}
