"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";

export function OfflineBanner() {
  const { t } = useLanguage();
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    // Im Fluss des Layouts (nicht `fixed`): Als Overlay verdeckte die Leiste
    // Logo und Seitentitel, weil <main> keinen Abstand nach oben hatte.
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-brand-primary px-4 py-2 text-sm font-medium text-white"
    >
      <WifiOff className="h-4 w-4" />
      <span>{t.common.offline}</span>
    </div>
  );
}
