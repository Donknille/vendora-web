"use client";

import { useOfflineSyncBootstrap } from "@/lib/offline/useOfflineQueue";
import { IosInstallHint } from "@/components/ui/IosInstallHint";

/**
 * Mounted once inside the authenticated app: starts automatic offline sync
 * (drain on start / online / interval) and renders the iOS install hint.
 */
export function OfflineBootstrap() {
  useOfflineSyncBootstrap();
  return <IosInstallHint />;
}
