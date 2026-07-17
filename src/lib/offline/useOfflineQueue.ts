"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MarketSale } from "@/lib/types";
import type { QueuedOp, SaleState } from "./types";
import {
  subscribeQueue,
  getStatsSnapshot,
  getOpsSnapshot,
  EMPTY_STATS,
  EMPTY_OPS,
  initOfflineSync,
} from "./queue";

/** Live queue statistics (open / failed counts, last sync, subscription flag). */
export function useQueueStats() {
  return useSyncExternalStore(subscribeQueue, getStatsSnapshot, () => EMPTY_STATS);
}

/** All queued ops (stable reference between changes); filter per market with useMemo. */
export function useQueueOps(): QueuedOp[] {
  return useSyncExternalStore(subscribeQueue, getOpsSnapshot, () => EMPTY_OPS);
}

export function useMarketQueueOps(marketId: string): QueuedOp[] {
  const ops = useQueueOps();
  return useMemo(
    () => ops.filter((op) => op.marketId === marketId),
    [ops, marketId]
  );
}

/**
 * Starts automatic offline sync once, app-wide. Mount from a single client
 * component near the root.
 */
export function useOfflineSyncBootstrap() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    initOfflineSync().then((fn) => {
      cleanup = fn;
    });
    return () => cleanup?.();
  }, []);
}

// ── Optimistic merge of server sales + local queue ops ─────

export interface DisplaySale {
  clientId: string;
  serverId?: string;
  description: string;
  amount: number;
  quantity: number;
  createdAt: string;
  status: SaleState;
  lastError?: string;
}

/**
 * Merges server sales with local queue ops for optimistic display:
 *  - pending/syncing/failed local creates are shown immediately,
 *  - a synced local create is shown until the server refetch includes it (then
 *    the server row wins — deduped by clientId, no flicker),
 *  - sales with a not-yet-synced delete op are hidden.
 * Newest first.
 */
export function mergeMarketSales(
  serverSales: MarketSale[],
  ops: QueuedOp[]
): DisplaySale[] {
  const pendingDeletes = new Set(
    ops
      .filter((op) => op.op === "delete" && op.state !== "synced")
      .map((op) => op.clientId)
  );
  const serverByClient = new Set(serverSales.map((s) => s.clientId));

  const result: DisplaySale[] = [];
  const shown = new Set<string>();

  for (const op of ops) {
    if (op.op !== "create") continue;
    if (pendingDeletes.has(op.clientId)) continue;
    // synced local op already present server-side → let the server row render it
    if (op.state === "synced" && serverByClient.has(op.clientId)) continue;
    result.push({
      clientId: op.clientId,
      serverId: op.payload.serverId,
      description: op.payload.description,
      amount: op.payload.amount,
      quantity: op.payload.quantity,
      createdAt: op.payload.createdAt,
      status: op.state,
      lastError: op.lastError,
    });
    shown.add(op.clientId);
  }

  for (const sale of serverSales) {
    if (pendingDeletes.has(sale.clientId)) continue;
    if (shown.has(sale.clientId)) continue;
    result.push({
      clientId: sale.clientId,
      serverId: sale.id,
      description: sale.description,
      amount: Number(sale.amount),
      quantity: Number(sale.quantity),
      createdAt: sale.createdAt,
      status: "synced",
    });
  }

  result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return result;
}
