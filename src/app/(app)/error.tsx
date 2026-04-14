"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <Card className="max-w-md w-full text-center">
        <h2 className="text-lg font-semibold text-primary mb-2">
          Etwas ist schiefgelaufen
        </h2>
        <p className="text-sm text-muted mb-4">
          {error.message || "Ein unerwarteter Fehler ist aufgetreten."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors"
        >
          Erneut versuchen
        </button>
      </Card>
    </div>
  );
}
