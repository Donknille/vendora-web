// Durable offline queue for market sales (Phase 3.2), backed by IndexedDB.
//
// A sale is written here FIRST (survives reloads / connection loss) and only
// removed once the server has confirmed it. Each record carries a
// client-generated `clientId` (UUID) that the batch endpoint uses as an
// idempotency key, so re-syncing the same sale never double-counts.

export type SalePaymentMethod = "cash" | "card";

export interface PendingSale {
  clientId: string;
  marketId: string;
  description: string;
  amount: number; // cents
  quantity: number;
  paymentMethod: SalePaymentMethod | null;
  createdAt: string; // ISO — the moment the sale was recorded
}

const DB_NAME = "vendora-offline";
const DB_VERSION = 1;
const STORE = "pending_sales";

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "clientId" });
        store.createIndex("marketId", "marketId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueSale(sale: PendingSale): Promise<void> {
  const db = await openDB();
  try {
    await promisify(tx(db, "readwrite").put(sale));
  } finally {
    db.close();
  }
}

export async function getPendingSales(marketId?: string): Promise<PendingSale[]> {
  const db = await openDB();
  try {
    const store = tx(db, "readonly");
    const all = (await promisify(store.getAll())) as PendingSale[];
    const list = marketId ? all.filter((s) => s.marketId === marketId) : all;
    // Oldest first so sales sync in the order they were recorded.
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function removePendingSales(clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) return;
  const db = await openDB();
  try {
    const store = tx(db, "readwrite");
    await Promise.all(clientIds.map((id) => promisify(store.delete(id))));
  } finally {
    db.close();
  }
}

export async function countPendingSales(marketId?: string): Promise<number> {
  return (await getPendingSales(marketId)).length;
}

export interface SyncResult {
  clientId: string;
  status: "ok" | "error";
  /** true = der Server wird diesen Eintrag NIE annehmen (Schema verletzt). */
  permanent?: boolean;
}

/**
 * Splits a batch response into sales that may leave the queue and sales that
 * must stay.
 *
 * ONLY `status: "ok"` is a confirmation that the sale is on the server. Every
 * other status means it is not — deleting it locally would destroy a real sale
 * (money taken at the stall) and leave the queue looking empty. Rejected sales
 * therefore stay queued, get retried, and are surfaced in the UI.
 */
export function partitionSyncResults(results: SyncResult[]): {
  confirmed: string[];
  rejected: string[];
  invalid: string[];
} {
  const confirmed: string[] = [];
  const rejected: string[] = [];
  const invalid: string[] = [];
  for (const r of results) {
    if (r.status === "ok") {
      confirmed.push(r.clientId);
      continue;
    }
    rejected.push(r.clientId);
    // Dauerhaft ungueltig: bleibt gespeichert und sichtbar, wird aber nicht
    // endlos erneut gesendet und zaehlt nicht im Tagesabschluss mit -- sonst
    // zeigte die Kasse Geld, das der Server nie gespeichert hat.
    if (r.permanent) invalid.push(r.clientId);
  }
  return { confirmed, rejected, invalid };
}
