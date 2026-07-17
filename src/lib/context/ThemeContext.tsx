"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePersistentState } from "@/lib/hooks/usePersistentState";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // SSR renders "system"; the client reconciles to the stored theme after
  // hydration via useSyncExternalStore (no setState-in-effect needed).
  const [theme, setTheme] = usePersistentState<Theme>("vendora_theme", "system");

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
    };

    if (theme === "dark") {
      applyTheme(true);
    } else if (theme === "light") {
      applyTheme(false);
    } else {
      // System — apply and listen for changes
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mql.matches);

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  const isDark =
    theme === "dark" ||
    (theme === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
