"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import {
  enqueueSale,
  getPendingSales,
  partitionSyncResults,
  removePendingSales,
  type PendingSale,
  type SalePaymentMethod,
} from "./salesQueue";

const CHUNK = 100; // must match MAX_BATCH on the server

type BatchResult =
  | { clientId: string; status: "ok" }
  | { clientId: string; status: "error" };

export interface RecordSaleInput {
  description: string;
  amount: number; // cents
  quantity: number;
  paymentMethod?: SalePaymentMethod | null;
}

/**
 * Offline-first recording of market sales (Phase 3.2). Every sale is written to
 * a durable IndexedDB queue first, then synced to the server in idempotent
 * batches whenever connectivity allows. The returned `pending` list lets the UI
 * show unsynced sales optimistically and a sync-status indicator.
 */
export function useOfflineSales(marketId: string) {
  const userId = useCurrentUserId();
  const [pending, setPending] = useState<PendingSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  // Sales the server explicitly rejected. They STAY in the queue — a rejected
  // sale is money that was taken at the stall, so it must never disappear
  // silently. The UI shows them instead of the "everything synced" state.
  const [rejected, setRejected] = useState<string[]>([]);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    if (!marketId) return;
    try {
      setPending(await getPendingSales(marketId));
    } catch {
      // IndexedDB unavailable (e.g. private mode) — degrade to no pending list.
    }
  }, [marketId]);

  const sync = useCallback(async () => {
    if (!marketId || syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const queued = await getPendingSales(marketId).catch(() => []);
      for (let i = 0; i < queued.length; i += CHUNK) {
        const chunk = queued.slice(i, i + CHUNK);
        let results: BatchResult[];
        try {
          const res = await apiRequest(
            "POST",
            `/api/markets/${marketId}/sales/batch`,
            chunk.map((s) => ({
              clientId: s.clientId,
              description: s.description,
              amount: s.amount,
              quantity: s.quantity,
              paymentMethod: s.paymentMethod,
              createdAt: s.createdAt,
            }))
          );
          const parsed = await res.json();
          if (!Array.isArray(parsed)) break; // unexpected shape — keep the queue
          results = parsed as BatchResult[];
        } catch {
          // Offline or a transient/auth error — keep the queue and retry later.
          break;
        }
        // Only CONFIRMED sales leave the queue. Rejected ones stay: they are
        // retried on the next sync and remain visible as unsynced until the
        // user resolves them (fix or undo). Dropping them here would delete a
        // real sale and then show the queue as empty.
        const { confirmed, rejected: failed } = partitionSyncResults(results);
        await removePendingSales(confirmed);
        setRejected((prev) => {
          const next = new Set(prev);
          confirmed.forEach((id) => next.delete(id));
          failed.forEach((id) => next.add(id));
          return [...next];
        });
      }
      if (userId) {
        queryClient.invalidateQueries({ queryKey: [userId, "/api/markets"] });
        queryClient.invalidateQueries({ queryKey: [userId, "/api/market-sales"] });
      }
    } finally {
      await refreshPending();
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [marketId, userId, refreshPending]);

  const recordSale = useCallback(
    async (input: RecordSaleInput): Promise<string> => {
      const clientId = crypto.randomUUID();
      const sale: PendingSale = {
        clientId,
        marketId,
        description: input.description,
        amount: input.amount,
        quantity: input.quantity,
        paymentMethod: input.paymentMethod ?? null,
        createdAt: new Date().toISOString(),
      };
      await enqueueSale(sale);
      await refreshPending();
      void sync();
      return clientId;
    },
    [marketId, refreshPending, sync]
  );

  // Remove a not-yet-synced sale from the queue (undo of a mis-entry).
  const dequeue = useCallback(
    async (clientId: string) => {
      await removePendingSales([clientId]);
      setRejected((prev) => prev.filter((id) => id !== clientId));
      await refreshPending();
    },
    [refreshPending]
  );

  useEffect(() => {
    void refreshPending();
    void sync();
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refreshPending, sync]);

  return {
    pending,
    pendingCount: pending.length,
    // clientIds the server rejected — still queued, never silently dropped.
    rejected,
    rejectedCount: rejected.length,
    syncing,
    recordSale,
    dequeue,
    sync,
  };
}
