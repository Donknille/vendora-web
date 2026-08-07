"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { queryClient } from "@/lib/api-client";
import {
  OFFLINE_CACHE_KEY,
  OFFLINE_CACHE_MAX_AGE,
  dehydrateFilter,
} from "@/lib/offlineCache";
import { AuthProvider } from "@/lib/context/AuthContext";
import { LanguageProvider } from "@/lib/context/LanguageContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import type { Language, Theme } from "@/lib/prefs";

export function Providers({
  children,
  initialTheme,
  initialDark,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
  initialDark?: boolean;
  initialLanguage?: Language;
}) {
  // Erst im Effekt, nie beim Rendern: localStorage existiert auf dem Server
  // nicht, und ein Wiederherstellen während des ersten Renders würde die
  // Hydration auseinanderlaufen lassen.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: OFFLINE_CACHE_KEY,
    });

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: OFFLINE_CACHE_MAX_AGE,
      // Der Puffer wird nur für den Marktmodus gehalten — siehe lib/offlineCache.ts.
      dehydrateOptions: { shouldDehydrateQuery: dehydrateFilter },
    });

    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider initialTheme={initialTheme} initialDark={initialDark}>
          <LanguageProvider initialLanguage={initialLanguage}>
            <ToastProvider>
              {children}
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
