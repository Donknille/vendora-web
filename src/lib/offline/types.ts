// ============================================================
// Offline queue types (Phase 4).
// ============================================================

export type SaleState = "pending" | "syncing" | "synced" | "failed";
export type OpType = "create" | "delete";

/**
 * The full payload for a sale. `clientId` is the client-generated UUID v4 (V1),
 * `createdAt` is the client sale time as an ISO-8601 string (V2). `serverId` is
 * the server-assigned primary key, filled in once a create has been confirmed —
 * it is what a later `delete` op targets.
 */
export interface MarketSalePayload {
  clientId: string;
  marketId: string;
  description: string;
  amount: number;
  quantity: number;
  createdAt: string;
  serverId?: string;
}

/**
 * A single queued operation. Keyed by `clientId` in IndexedDB, so there is at
 * most one record per sale: correcting a synced sale flips the same record from
 * `create` to `delete` rather than adding a second record.
 *
 * `nextAttemptAt` (ms epoch) is an addition to the record shape from the brief:
 * it is required to honour the exponential backoff in V4 — the drain skips an
 * op until it is due, instead of retrying it on every 30s tick.
 */
export interface QueuedOp {
  clientId: string;
  marketId: string;
  op: OpType;
  payload: MarketSalePayload;
  state: SaleState;
  attempts: number;
  lastError?: string;
  createdAt: string;
  nextAttemptAt?: number;
}

/** Minimal market snapshot preloaded for offline start of the sell screen. */
export interface PreloadedMarket {
  id: string;
  name: string;
  date: string;
  location: string;
  quickItems: { name: string; price: number }[];
  preloadedAt: string;
}

export interface QueueStats {
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
  /** pending + syncing — the "open" (not yet confirmed, not failed) count. */
  open: number;
  lastSyncAt: string | null;
  subscriptionRequired: boolean;
}
