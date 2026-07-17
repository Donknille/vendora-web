"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  WifiOff,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { useQueueStats, useQueueOps } from "@/lib/offline/useOfflineQueue";
import { retryFailed } from "@/lib/offline/queue";
import { formatCurrency } from "@/lib/formatCurrency";

function subscribeOnlineStatus(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OfflineBanner() {
  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    () => !navigator.onLine,
    () => false
  );
  const stats = useQueueStats();
  const ops = useQueueOps();
  const failedOps = useMemo(
    () => ops.filter((op) => op.state === "failed"),
    [ops]
  );

  const [expanded, setExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const show =
    isOffline || stats.open > 0 || stats.failed > 0 || stats.subscriptionRequired;
  if (!show) return null;

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retryFailed();
    } finally {
      setRetrying(false);
    }
  };

  // Highest-priority variant wins.
  let tone = "bg-brand-primary text-white";
  let icon = <Loader2 className="h-4 w-4 animate-spin" />;
  let message = "";

  if (stats.subscriptionRequired) {
    tone = "bg-red-600 text-white";
    icon = <CreditCard className="h-4 w-4" />;
    message = `Abo abgelaufen — ${stats.failed} Buchung${stats.failed === 1 ? "" : "en"} lokal gesichert`;
  } else if (isOffline) {
    tone = "bg-brand-primary text-white";
    icon = <WifiOff className="h-4 w-4" />;
    message =
      stats.open > 0
        ? `Offline — ${stats.open} Buchung${stats.open === 1 ? "" : "en"} werden synchronisiert, sobald du online bist`
        : "Keine Internetverbindung";
  } else if (stats.failed > 0) {
    tone = "bg-amber-500 text-white";
    icon = <AlertTriangle className="h-4 w-4" />;
    message = `${stats.failed} Buchung${stats.failed === 1 ? "" : "en"} fehlgeschlagen`;
  } else {
    tone = "bg-brand-primary text-white";
    icon = <Loader2 className="h-4 w-4 animate-spin" />;
    message = `Synchronisiere ${stats.open} Buchung${stats.open === 1 ? "" : "en"}…`;
  }

  const canRetry = stats.failed > 0 || stats.subscriptionRequired;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${tone}`}>
        {icon}
        <span className="min-w-0 flex-1 truncate">{message}</span>
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-1 text-xs font-semibold hover:bg-white/30 disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
            Erneut
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md p-1 hover:bg-white/20 transition-colors"
          aria-label="Details"
          aria-expanded={expanded}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="border-b border-line bg-surface px-4 py-3 text-sm shadow-lg">
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>Offen: <b className="text-secondary">{stats.open}</b></span>
              <span>Fehlgeschlagen: <b className="text-secondary">{stats.failed}</b></span>
              <span>Letzter Sync: <b className="text-secondary">{formatTime(stats.lastSyncAt)}</b></span>
            </div>

            {stats.subscriptionRequired && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-500">
                <p className="font-medium">Dein Abo ist abgelaufen.</p>
                <p className="mt-1 text-xs">
                  Deine Verkäufe sind lokal gespeichert und gehen nicht verloren.
                  Sobald dein Abo wieder aktiv ist, kannst du sie synchronisieren.
                </p>
                <Link
                  href="/settings"
                  className="mt-2 inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  <CreditCard className="h-3 w-3" />
                  Abo verwalten
                </Link>
              </div>
            )}

            {failedOps.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-faint">
                  Fehlgeschlagene Buchungen
                </p>
                {failedOps.slice(0, 20).map((op) => (
                  <div
                    key={op.clientId}
                    className="flex items-center justify-between rounded-lg border border-line bg-page px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-secondary">
                        {op.op === "delete"
                          ? "Löschen"
                          : op.payload.description || "Verkauf"}
                        {op.op === "create" && (
                          <span className="ml-2 text-xs text-muted">
                            {formatCurrency(op.payload.amount * op.payload.quantity)}
                          </span>
                        )}
                      </p>
                      {op.lastError && (
                        <p className="truncate text-xs text-red-400">{op.lastError}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-60 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                Alle erneut versuchen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
