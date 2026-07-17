import { openDB, type IDBPDatabase } from "idb";
import type {
  QueuedOp,
  MarketSalePayload,
  PreloadedMarket,
  QueueStats,
  SaleState,
} from "./types";

// ============================================================
// Offline queue (Phase 4).
//
// The offline behaviour of the market mode lives here: sales are recorded
// locally, drained to the server idempotently (V1) and never dropped just
// because a request was fired (V3). Error handling follows the V4 table.
//
// Design notes:
//  - Pure helpers (backoff, classification, stuck-reset, batching) are exported
//    separately so they can be unit-tested without IndexedDB.
//  - `drain` takes an injectable dependency bag (store + fetch + session
//    refresh + clock) with production defaults, so its control flow — including
//    "a 403 stops the drain and deletes nothing" — is testable with in-memory
//    fakes and no new test dependency.
// ============================================================

export const MAX_BATCH = 100;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 60_000; // V4: cap at 60 seconds
const SYNCED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // prune synced records after 30d
const DRAIN_INTERVAL_MS = 30_000;

// ── Pure helpers (exported for tests) ──────────────────────

export function isOpen(op: QueuedOp): boolean {
  return op.state === "pending" || op.state === "syncing";
}

export function isDue(op: QueuedOp, nowMs: number): boolean {
  return (op.nextAttemptAt ?? 0) <= nowMs;
}

/**
 * V3: on app start every op stuck in `syncing` (from a crash/close mid-request)
 * is reset to `pending`. Idempotency (V1) makes replaying them safe.
 */
export function resetStuckOps(ops: QueuedOp[]): QueuedOp[] {
  return ops.map((op) =>
    op.state === "syncing" ? { ...op, state: "pending" as SaleState } : op
  );
}

/**
 * V4: exponential backoff with equal jitter, capped at 60s. `random` is
 * injectable for deterministic tests. Never returns more than the cap.
 */
export function computeBackoffMs(
  attempts: number,
  random: () => number = Math.random,
  base = BACKOFF_BASE_MS,
  cap = BACKOFF_CAP_MS
): number {
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempts - 1));
  // equal jitter: half fixed, half random — avoids a near-zero retry delay.
  return Math.round(exp / 2 + random() * (exp / 2));
}

export type DrainAction =
  | { kind: "synced" }
  | { kind: "retry" } // network / 5xx → back to pending + backoff
  | { kind: "failed"; message: string } // 400 → failed, no retry
  | { kind: "auth-retry" } // 401 → refresh session once, one retry
  | { kind: "subscription-required"; message: string }; // 403 → stop drain

/**
 * V4 classification of an HTTP response. Network errors (fetch throws) are
 * handled at the call site as `retry`.
 */
export function classifyStatus(status: number, body?: unknown): DrainAction {
  const b = (body ?? {}) as { code?: string; message?: string };
  if (status >= 200 && status < 300) return { kind: "synced" };
  if (status === 401) return { kind: "auth-retry" };
  if (status === 403 && b.code === "SUBSCRIPTION_REQUIRED") {
    return {
      kind: "subscription-required",
      message: b.message ?? "Abo erforderlich",
    };
  }
  if (status === 400) {
    return { kind: "failed", message: b.message ?? "Validierungsfehler" };
  }
  if (status >= 500) return { kind: "retry" };
  // Other 4xx: fail without retry to avoid an infinite loop.
  return { kind: "failed", message: b.message ?? `HTTP ${status}` };
}

export interface CreateBatch {
  marketId: string;
  ops: QueuedOp[];
}

/**
 * Groups pending `create` ops by market and chunks each market into batches of
 * at most `maxSize` (Phase 4.5). Deletes are ignored here.
 */
export function groupCreatesIntoBatches(
  ops: QueuedOp[],
  maxSize = MAX_BATCH
): CreateBatch[] {
  const byMarket = new Map<string, QueuedOp[]>();
  for (const op of ops) {
    if (op.op !== "create") continue;
    const list = byMarket.get(op.marketId) ?? [];
    list.push(op);
    byMarket.set(op.marketId, list);
  }
  const batches: CreateBatch[] = [];
  for (const [marketId, list] of byMarket) {
    for (let i = 0; i < list.length; i += maxSize) {
      batches.push({ marketId, ops: list.slice(i, i + maxSize) });
    }
  }
  return batches;
}

// ── Store abstraction ──────────────────────────────────────

export interface QueueStore {
  getAllOps(): Promise<QueuedOp[]>;
  getOp(clientId: string): Promise<QueuedOp | undefined>;
  putOp(op: QueuedOp): Promise<void>;
  deleteOp(clientId: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
}

const DB_NAME = "vendora-offline";
const DB_VERSION = 1;
const OPS_STORE = "ops";
const MARKETS_STORE = "markets";
const META_STORE = "meta";

const META_LAST_SYNC = "lastSyncAt";
const META_SUBSCRIPTION_REQUIRED = "subscriptionRequired";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(OPS_STORE)) {
          db.createObjectStore(OPS_STORE, { keyPath: "clientId" });
        }
        if (!db.objectStoreNames.contains(MARKETS_STORE)) {
          db.createObjectStore(MARKETS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
    });
  }
  return dbPromise;
}

export const idbStore: QueueStore = {
  async getAllOps() {
    return (await getDb()).getAll(OPS_STORE) as Promise<QueuedOp[]>;
  },
  async getOp(clientId) {
    return (await getDb()).get(OPS_STORE, clientId) as Promise<QueuedOp | undefined>;
  },
  async putOp(op) {
    await (await getDb()).put(OPS_STORE, op);
  },
  async deleteOp(clientId) {
    await (await getDb()).delete(OPS_STORE, clientId);
  },
  async getMeta<T>(key: string) {
    return (await getDb()).get(META_STORE, key) as Promise<T | undefined>;
  },
  async setMeta(key, value) {
    await (await getDb()).put(META_STORE, value, key);
  },
};

// ── Subscriptions (for the UI) ─────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // a bad listener must not break the queue
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("vendora:queue-changed"));
  }
}

// ── Public queue API ───────────────────────────────────────

/** Records a new sale locally (state `pending`). Does not send by itself. */
export async function enqueueSale(payload: MarketSalePayload): Promise<QueuedOp> {
  const op: QueuedOp = {
    clientId: payload.clientId,
    marketId: payload.marketId,
    op: "create",
    payload,
    state: "pending",
    attempts: 0,
    createdAt: payload.createdAt,
    nextAttemptAt: 0,
  };
  await idbStore.putOp(op);
  notify();
  return op;
}

/**
 * Phase 4.3: correcting a mistap. If the sale was never confirmed on the server
 * the record is dropped locally and never sent. If it was already `synced`, the
 * same record is flipped to a pending `delete` op (targeting its server id).
 */
export async function correctSale(clientId: string): Promise<void> {
  const op = await idbStore.getOp(clientId);
  if (!op) return;

  if (op.state === "synced" && op.payload.serverId) {
    await idbStore.putOp({
      ...op,
      op: "delete",
      state: "pending",
      attempts: 0,
      lastError: undefined,
      nextAttemptAt: 0,
    });
  } else {
    await idbStore.deleteOp(clientId);
  }
  notify();
}

export async function getOpsForMarket(marketId: string): Promise<QueuedOp[]> {
  const all = await idbStore.getAllOps();
  return all.filter((op) => op.marketId === marketId);
}

export async function getFailedOps(): Promise<QueuedOp[]> {
  return (await idbStore.getAllOps()).filter((op) => op.state === "failed");
}

export async function getQueueStats(): Promise<QueueStats> {
  const all = await idbStore.getAllOps();
  const countBy = (state: SaleState) =>
    all.filter((op) => op.state === state).length;
  const pending = countBy("pending");
  const syncing = countBy("syncing");
  return {
    pending,
    syncing,
    failed: countBy("failed"),
    synced: countBy("synced"),
    open: pending + syncing,
    lastSyncAt: (await idbStore.getMeta<string>(META_LAST_SYNC)) ?? null,
    subscriptionRequired:
      (await idbStore.getMeta<boolean>(META_SUBSCRIPTION_REQUIRED)) === true,
  };
}

/** Re-queues all failed ops and clears the subscription flag, then drains. */
export async function retryFailed(): Promise<void> {
  const all = await idbStore.getAllOps();
  for (const op of all) {
    if (op.state === "failed") {
      await idbStore.putOp({
        ...op,
        state: "pending",
        attempts: 0,
        lastError: undefined,
        nextAttemptAt: 0,
      });
    }
  }
  await idbStore.setMeta(META_SUBSCRIPTION_REQUIRED, false);
  notify();
  void drain();
}

// ── Market preload (Phase 4.6) ─────────────────────────────

export async function preloadMarket(
  market: Omit<PreloadedMarket, "preloadedAt">
): Promise<void> {
  const db = await getDb();
  const record: PreloadedMarket = {
    ...market,
    preloadedAt: new Date().toISOString(),
  };
  await db.put(MARKETS_STORE, record);
}

export async function getPreloadedMarket(
  id: string
): Promise<PreloadedMarket | undefined> {
  return (await getDb()).get(MARKETS_STORE, id) as Promise<
    PreloadedMarket | undefined
  >;
}

// ── Drain ──────────────────────────────────────────────────

export interface DrainDeps {
  store: QueueStore;
  fetchImpl: typeof fetch;
  refreshSession: () => Promise<boolean>;
  now: () => number;
}

function defaultDeps(): DrainDeps {
  return {
    store: idbStore,
    fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args),
    refreshSession: defaultRefreshSession,
    now: () => Date.now(),
  };
}

async function defaultRefreshSession(): Promise<boolean> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().auth.refreshSession();
    return !error;
  } catch {
    return false;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function setState(
  store: QueueStore,
  ops: QueuedOp[],
  state: SaleState
): Promise<void> {
  for (const op of ops) {
    await store.putOp({ ...op, state });
  }
}

async function retryLater(
  deps: DrainDeps,
  ops: QueuedOp[],
  message: string
): Promise<void> {
  for (const op of ops) {
    const attempts = op.attempts + 1;
    await deps.store.putOp({
      ...op,
      state: "pending",
      attempts,
      lastError: message,
      nextAttemptAt: deps.now() + computeBackoffMs(attempts),
    });
  }
}

async function failOps(
  store: QueueStore,
  ops: QueuedOp[],
  message: string
): Promise<void> {
  for (const op of ops) {
    await store.putOp({ ...op, state: "failed", lastError: message });
  }
}

async function markSynced(
  store: QueueStore,
  op: QueuedOp,
  serverId?: string
): Promise<void> {
  await store.putOp({
    ...op,
    state: "synced",
    lastError: undefined,
    payload: { ...op.payload, serverId: serverId ?? op.payload.serverId },
  });
}

let draining = false;

/**
 * Drains due, pending ops to the server. Concurrency-safe via an in-process
 * lock (V3): a second call while a drain is running is a no-op. Ops are marked
 * `syncing` before being sent, so a crash mid-drain leaves them recoverable.
 */
export async function drain(deps: Partial<DrainDeps> = {}): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    await performDrain({ ...defaultDeps(), ...deps });
  } finally {
    draining = false;
  }
}

async function performDrain(deps: DrainDeps): Promise<void> {
  const all = await deps.store.getAllOps();
  const nowMs = deps.now();
  const due = all.filter((op) => op.state === "pending" && isDue(op, nowMs));
  if (due.length === 0) return;

  const refreshedRef = { value: false }; // 401 refresh at most once per drain

  // Creates first, batched per market.
  for (const batch of groupCreatesIntoBatches(due, MAX_BATCH)) {
    await setState(deps.store, batch.ops, "syncing");
    const stopped = await sendCreateBatch(batch, deps, refreshedRef);
    if (stopped) {
      notify();
      return; // V4: 403 stops the drain; remaining ops stay untouched.
    }
  }

  // Then deletes, one by one.
  for (const op of due.filter((o) => o.op === "delete")) {
    const stopped = await sendDelete(op, deps, refreshedRef);
    if (stopped) {
      notify();
      return;
    }
  }

  notify();
}

/** Returns true when the drain must stop entirely (subscription required). */
async function sendCreateBatch(
  batch: CreateBatch,
  deps: DrainDeps,
  refreshedRef: { value: boolean }
): Promise<boolean> {
  const body = batch.ops.map((op) => ({
    clientId: op.payload.clientId,
    description: op.payload.description,
    amount: op.payload.amount,
    quantity: op.payload.quantity,
    createdAt: op.payload.createdAt,
  }));

  let response: Response;
  try {
    response = await deps.fetchImpl(
      `/api/markets/${batch.marketId}/sales/batch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  } catch {
    await retryLater(deps, batch.ops, "Netzwerkfehler");
    return false;
  }

  // 401: refresh the session once, then retry this batch a single time.
  if (response.status === 401 && !refreshedRef.value) {
    refreshedRef.value = true;
    if (await deps.refreshSession()) {
      return sendCreateBatch(batch, deps, refreshedRef);
    }
    await failOps(deps.store, batch.ops, "Sitzung abgelaufen");
    return false;
  }

  const json = await safeJson(response);
  const action = classifyStatus(response.status, json);

  switch (action.kind) {
    case "subscription-required":
      await failOps(deps.store, batch.ops, action.message);
      await deps.store.setMeta(META_SUBSCRIPTION_REQUIRED, true);
      return true;
    case "retry":
      await retryLater(deps, batch.ops, `Serverfehler ${response.status}`);
      return false;
    case "failed":
    case "auth-retry":
      await failOps(
        deps.store,
        batch.ops,
        action.kind === "failed" ? action.message : "Sitzung abgelaufen"
      );
      return false;
    case "synced": {
      // 200 batch response: an array of per-entry results.
      const results = Array.isArray(json)
        ? (json as { clientId: string; status: string; row?: { id?: string }; message?: string }[])
        : [];
      const byClient = new Map(results.map((r) => [r.clientId, r]));
      for (const op of batch.ops) {
        const result = byClient.get(op.payload.clientId);
        if (result?.status === "ok") {
          await markSynced(deps.store, op, result.row?.id);
        } else if (result?.status === "error") {
          await failOps(deps.store, [op], result.message ?? "Ungültiger Eintrag");
        } else {
          await retryLater(deps, [op], "Keine Serverantwort für Eintrag");
        }
      }
      await deps.store.setMeta(
        META_LAST_SYNC,
        new Date(deps.now()).toISOString()
      );
      return false;
    }
  }
}

/** Returns true when the drain must stop entirely (subscription required). */
async function sendDelete(
  op: QueuedOp,
  deps: DrainDeps,
  refreshedRef: { value: boolean }
): Promise<boolean> {
  const serverId = op.payload.serverId;
  if (!serverId) {
    // Nothing exists server-side to delete — drop the record.
    await deps.store.deleteOp(op.clientId);
    return false;
  }

  await setState(deps.store, [op], "syncing");

  let response: Response;
  try {
    response = await deps.fetchImpl(`/api/market-sales/${serverId}`, {
      method: "DELETE",
    });
  } catch {
    await retryLater(deps, [op], "Netzwerkfehler");
    return false;
  }

  if (response.status === 401 && !refreshedRef.value) {
    refreshedRef.value = true;
    if (await deps.refreshSession()) {
      return sendDelete(op, deps, refreshedRef);
    }
    await failOps(deps.store, [op], "Sitzung abgelaufen");
    return false;
  }

  const json = await safeJson(response);
  const action = classifyStatus(response.status, json);

  switch (action.kind) {
    case "subscription-required":
      await failOps(deps.store, [op], action.message);
      await deps.store.setMeta(META_SUBSCRIPTION_REQUIRED, true);
      return true;
    case "retry":
      await retryLater(deps, [op], `Serverfehler ${response.status}`);
      return false;
    case "failed":
    case "auth-retry":
      await failOps(
        deps.store,
        [op],
        action.kind === "failed" ? action.message : "Sitzung abgelaufen"
      );
      return false;
    case "synced":
      await deps.store.deleteOp(op.clientId); // gone on the server → drop record
      await deps.store.setMeta(
        META_LAST_SYNC,
        new Date(deps.now()).toISOString()
      );
      return false;
  }
}

// ── Bootstrap / auto-sync (Phase 4.4) ──────────────────────

let initialized = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Wires up automatic syncing (Phase 4.4): resets stuck ops, then drains on app
 * start, on the `online` event, and on a 30s interval while open ops exist.
 * Returns a cleanup function. Safe to call once from a client component.
 */
export async function initOfflineSync(): Promise<() => void> {
  if (initialized || typeof window === "undefined") return () => {};
  initialized = true;

  // V3: reset stuck syncing → pending, then prune old synced records.
  const all = await idbStore.getAllOps();
  for (const op of all) {
    if (op.state === "syncing") {
      await idbStore.putOp({ ...op, state: "pending" });
    } else if (op.state === "synced" && Date.parse(op.createdAt) < Date.now() - SYNCED_TTL_MS) {
      await idbStore.deleteOp(op.clientId);
    }
  }

  const onOnline = () => void drain();
  window.addEventListener("online", onOnline);

  intervalId = setInterval(async () => {
    const stats = await getQueueStats();
    if (stats.open > 0) void drain();
  }, DRAIN_INTERVAL_MS);

  void drain();

  return () => {
    window.removeEventListener("online", onOnline);
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    initialized = false;
  };
}
