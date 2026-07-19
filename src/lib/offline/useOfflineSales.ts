"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, queryClient } from "@/lib/api-client";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import {
  enqueueSale,
  getPendingSales,
  removePendingSales,
  type PendingSale,
} from "./salesQueue";

const CHUNK = 100; // must match MAX_BATCH on the server

type BatchResult =
  | { clientId: string; status: "ok" }
  | { clientId: string; status: "error" };

export interface RecordSaleInput {
  description: string;
  amount: number; // cents
  quantity: number;
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
              createdAt: s.createdAt,
            }))
          );
          results = (await res.json()) as BatchResult[];
        } catch {
          // Offline or a transient/auth error — keep the queue and retry later.
          break;
        }
        // Drop confirmed sales AND permanently-invalid ones (a validation error
        // would otherwise wedge the queue forever).
        const settled = results.map((r) => r.clientId);
        await removePendingSales(settled);
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
    async (input: RecordSaleInput) => {
      const sale: PendingSale = {
        clientId: crypto.randomUUID(),
        marketId,
        description: input.description,
        amount: input.amount,
        quantity: input.quantity,
        createdAt: new Date().toISOString(),
      };
      await enqueueSale(sale);
      await refreshPending();
      void sync();
    },
    [marketId, refreshPending, sync]
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
    syncing,
    recordSale,
    sync,
  };
}
