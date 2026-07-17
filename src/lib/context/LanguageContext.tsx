"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type Language, getDeviceLanguage, getTranslations, type Translations } from "@/lib/i18n";
import { usePersistentState } from "@/lib/hooks/usePersistentState";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR renders "de"; the client reconciles to the stored language (or the
  // device language when unset) after hydration via useSyncExternalStore.
  const [language, setLanguage] = usePersistentState<Language>(
    "vendora_language",
    "de",
    getDeviceLanguage
  );

  const t = getTranslations(language);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
