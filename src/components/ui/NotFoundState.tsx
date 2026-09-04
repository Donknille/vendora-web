"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";

/**
 * Ein Datensatz, den es (nicht mehr) gibt — veralteter Link, gelöschter
 * Markt, fremde ID. Bewusst getrennt vom Leerzustand der Listen: Wer über
 * einen alten Link kommt, soll nicht „Noch keine Märkte" lesen und glauben,
 * seine Buchhaltung sei weg.
 */
export function NotFoundState({ backHref }: { backHref: string }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 text-muted">
        <SearchX className="h-12 w-12" />
      </div>
      <h3 className="text-lg font-medium text-secondary">{t.common.notFoundRecordTitle}</h3>
      <p className="mt-1 text-sm text-muted max-w-xs">{t.common.notFoundRecordSub}</p>
      <Link
        href={backHref}
        className="mt-4 rounded-lg border border-line px-4 py-2 text-sm font-medium text-primary hover:bg-elevated transition-colors"
      >
        {t.common.backToList}
      </Link>
    </div>
  );
}
