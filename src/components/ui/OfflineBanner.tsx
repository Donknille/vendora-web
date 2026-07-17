"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeOnlineStatus(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineBanner() {
  // Read connectivity from the browser via useSyncExternalStore: the server
  // snapshot assumes online, the client reads navigator.onLine. Avoids the
  // setState-in-effect hydration pattern.
  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    () => !navigator.onLine,
    () => false
  );

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-brand-primary px-4 py-2 text-sm font-medium text-white">
      <WifiOff className="h-4 w-4" />
      <span>Keine Internetverbindung</span>
    </div>
  );
}
