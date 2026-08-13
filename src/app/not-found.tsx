"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useLanguage } from "@/lib/context/LanguageContext";

/**
 * 404 für die ganze Anwendung.
 *
 * Ohne diese Datei liefert Next.js seine eigene Standardseite aus: englisch,
 * ohne Layout, ohne Theme — für jemanden, der sich schlicht vertippt hat, sieht
 * das aus, als sei die Anwendung kaputt.
 *
 * Client-Komponente, weil sie über LanguageContext dieselbe Sprache spricht wie
 * der Rest. `not-found` rendert innerhalb des Root-Layouts, die Provider stehen
 * hier also bereits.
 */
export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <p className="text-5xl font-bold text-brand-primary mb-3 tabular-nums">404</p>
        <h1 className="text-lg font-semibold text-primary mb-2">{t.common.notFoundTitle}</h1>
        <p className="text-sm text-muted mb-6">{t.common.notFoundSub}</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          {t.common.backHome}
        </Link>
      </Card>
    </div>
  );
}
