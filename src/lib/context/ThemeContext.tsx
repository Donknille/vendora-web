"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { DARK_COOKIE, THEME_COOKIE, isTheme, prefCookie, resolveDark, type Theme } from "@/lib/prefs";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * The initial values come from the server (cookie), so the first client render
 * is identical to the server render — no reading of localStorage or matchMedia
 * in a useState initializer, which is what used to differ between the two.
 */
export function ThemeProvider({
  children,
  initialTheme = "system",
  initialDark = false,
}: {
  children: ReactNode;
  initialTheme?: Theme;
  initialDark?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [isDark, setIsDark] = useState(initialDark);

  // One-time bridge for browsers that still carry the old localStorage value:
  // copy it into the cookie so the *next* request renders it. Deliberately no
  // setState here — changing the theme mid-render would be a cascading render
  // for a transitional case that resolves itself on the next page load.
  useEffect(() => {
    if (document.cookie.includes(`${THEME_COOKIE}=`)) return;
    const saved = localStorage.getItem("vendora_theme");
    if (isTheme(saved)) document.cookie = prefCookie(THEME_COOKIE, saved);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (systemDark: boolean) => {
      const dark = resolveDark(theme, systemDark);
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
      // Persist what the OS reports so the *next* server render can resolve
      // "system" itself instead of guessing light.
      document.cookie = prefCookie(DARK_COOKIE, systemDark ? "1" : "0");
    };

    apply(mql.matches);
    if (theme !== "system") return;

    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.cookie = prefCookie(THEME_COOKIE, t);
  };

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
