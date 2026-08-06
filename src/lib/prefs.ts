// Theme and language live in cookies, not in localStorage.
//
// The reason is hydration: localStorage can only be read in the browser, so the
// server rendered `lang="de"` and a light `<html>` for everyone while the client
// rendered whatever was stored — a mismatch on every page load for anyone not on
// German + light. The previous workaround, a blocking `/theme-init.js` before
// paint, was worse: it put a <script> into the client <head> that the server HTML
// did not contain, which made React abort hydration (#418) for *every* user.
//
// A cookie is sent with the document request, so the server can render the final
// markup and no script has to run before paint.

export type Theme = "light" | "dark" | "system";
export type Language = "de" | "en";

export const THEME_COOKIE = "vendora_theme";
/** Resolved darkness — "system" cannot be evaluated on the server. */
export const DARK_COOKIE = "vendora_dark";
export const LANGUAGE_COOKIE = "vendora_language";

/** One year; these are functional settings, not tracking. */
export const PREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function isLanguage(value: string | null | undefined): value is Language {
  return value === "de" || value === "en";
}

/**
 * Whether dark mode applies. For an explicit choice the preference decides; for
 * "system" the last value the browser reported (persisted by the client) is the
 * best the server can do — on the very first visit that is light.
 */
export function resolveDark(theme: Theme, systemPrefersDark: boolean): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return systemPrefersDark;
}

/**
 * Pick a language from an Accept-Language header. Used only when no cookie has
 * been set yet, so the first render already matches what the client would pick.
 */
export function languageFromAcceptHeader(header: string | null | undefined): Language {
  if (!header) return "en";
  const primary = header.split(",")[0]?.trim().toLowerCase() ?? "";
  return primary.startsWith("de") ? "de" : "en";
}

/** Read one cookie out of a `document.cookie`-style string. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** The `document.cookie` assignment for a preference. */
export function prefCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; path=/; max-age=${PREF_COOKIE_MAX_AGE}; samesite=lax`;
}
