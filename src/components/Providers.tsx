"use client";

import { useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { LanguageProvider } from "@/lib/context/LanguageContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";

function AuthCacheGuard({ children }: { children: React.ReactNode }) {
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        lastUserId.current = null;
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // If user changed (different account), clear stale cache
        if (lastUserId.current && lastUserId.current !== newUserId) {
          queryClient.clear();
        }
        lastUserId.current = newUserId;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthCacheGuard>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthCacheGuard>
    </QueryClientProvider>
  );
}
