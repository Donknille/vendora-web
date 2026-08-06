"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api-client";
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
