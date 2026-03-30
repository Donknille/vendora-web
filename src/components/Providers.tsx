"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/api-client";
import { LanguageProvider } from "@/lib/context/LanguageContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
