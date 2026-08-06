"use client";

import { AlertTriangle } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";

/**
 * Shown when a read failed. Deliberately distinct from EmptyState: for a
 * bookkeeping tool, rendering "no expenses yet" because a request 500'd tells
 * the user their records are gone.
 */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLanguage();

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="mb-4 text-red-500">
        <AlertTriangle className="h-12 w-12" />
      </div>
      <h3 className="text-lg font-medium text-secondary">{t.common.loadError}</h3>
      <p className="mt-1 text-sm text-muted max-w-xs">{t.common.loadErrorSub}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-medium text-primary hover:bg-elevated transition-colors"
        >
          {t.common.retry}
        </button>
      )}
    </div>
  );
}
