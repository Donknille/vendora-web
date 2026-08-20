"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getTranslations, type Translations } from "@/lib/i18n";
import { LANGUAGE_COOKIE, isLanguage, prefCookie, type Language } from "@/lib/prefs";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * `initialLanguage` is resolved on the server (cookie, else Accept-Language),
 * so the client starts from the same value instead of reading localStorage in
 * a useState initializer — the server used to render "de" for everyone while an
 * English browser rendered "en", a mismatch on every page.
 */
export function LanguageProvider({
  children,
  initialLanguage = "de",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // One-time bridge for browsers that still carry the old localStorage value:
  // copy it into the cookie so the *next* request renders it. Deliberately no
  // setState here — see ThemeContext.
  useEffect(() => {
    if (document.cookie.includes(`${LANGUAGE_COOKIE}=`)) return;
    const saved = localStorage.getItem("bilanz-buddy-language");
    document.cookie = prefCookie(LANGUAGE_COOKIE, isLanguage(saved) ? saved : initialLanguage);
  }, [initialLanguage]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    document.cookie = prefCookie(LANGUAGE_COOKIE, lang);
    // Keeps <html lang> in step — it is rendered by the server layout.
    document.documentElement.lang = lang;
  };

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
