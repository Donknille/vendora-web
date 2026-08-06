import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DARK_COOKIE,
  LANGUAGE_COOKIE,
  THEME_COOKIE,
  isLanguage,
  isTheme,
  languageFromAcceptHeader,
  prefCookie,
  readCookie,
  resolveDark,
} from "@/lib/prefs";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

describe("resolveDark", () => {
  it("lets an explicit choice win over the system preference", () => {
    expect(resolveDark("dark", false)).toBe(true);
    expect(resolveDark("light", true)).toBe(false);
  });

  it("follows the system preference for 'system'", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
  });
});

describe("languageFromAcceptHeader", () => {
  it("reads the primary tag", () => {
    expect(languageFromAcceptHeader("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(languageFromAcceptHeader("en-US,en;q=0.9")).toBe("en");
    expect(languageFromAcceptHeader("DE")).toBe("de");
  });

  it("falls back to English for anything else", () => {
    expect(languageFromAcceptHeader(null)).toBe("en");
    expect(languageFromAcceptHeader("")).toBe("en");
    expect(languageFromAcceptHeader("fr-FR,fr;q=0.9")).toBe("en");
    // A German secondary preference does not outrank the primary one.
    expect(languageFromAcceptHeader("fr-FR,de;q=0.8")).toBe("en");
  });
});

describe("cookie helpers", () => {
  it("reads a value out of a document.cookie string", () => {
    const jar = `foo=1; ${THEME_COOKIE}=dark; ${LANGUAGE_COOKIE}=de`;
    expect(readCookie(jar, THEME_COOKIE)).toBe("dark");
    expect(readCookie(jar, LANGUAGE_COOKIE)).toBe("de");
    expect(readCookie(jar, DARK_COOKIE)).toBeNull();
    expect(readCookie("", THEME_COOKIE)).toBeNull();
  });

  it("writes a path-wide, samesite-lax cookie", () => {
    const c = prefCookie(THEME_COOKIE, "dark");
    expect(c).toContain(`${THEME_COOKIE}=dark`);
    expect(c).toContain("path=/");
    expect(c).toContain("samesite=lax");
  });
});

describe("guards", () => {
  it("rejects unknown values", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("neon")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isLanguage("de")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});

// Source guards: this is exactly how React #418 got in. A <script> in the root
// layout differs between server HTML and client DOM, and a browser-only read in
// a useState initializer makes the first client render differ from the server's.
describe("the root layout renders without a pre-paint script", () => {
  const layout = read("app/layout.tsx");

  it("carries no script tag and no theme-init", () => {
    expect(layout).not.toContain("next/script");
    expect(layout).not.toContain("theme-init");
    expect(layout).not.toMatch(/<script/i);
  });

  it("takes lang and theme from the request instead of hardcoding them", () => {
    expect(layout).not.toContain('lang="de"');
    expect(layout).toContain("cookies");
  });

  it("keeps browser-only reads out of the context initializers", () => {
    for (const rel of ["lib/context/ThemeContext.tsx", "lib/context/LanguageContext.tsx"]) {
      const source = read(rel);
      const initializer = source.slice(source.indexOf("useState"), source.indexOf("useEffect"));
      expect(initializer).not.toContain("localStorage");
      expect(initializer).not.toContain("matchMedia");
      expect(initializer).not.toContain("navigator");
    }
  });
});
