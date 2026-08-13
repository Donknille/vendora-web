import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { queryClient } from "@/lib/api-client";
import { resetNavigation } from "./nextNavigationMock";

/**
 * Setup fuer das `dom`-Projekt (siehe vitest.config.mts).
 *
 * Zweck ist ausschliesslich, jsdom auf das Niveau zu bringen, das der
 * Produktcode ohnehin voraussetzt. Hier wird nichts simuliert, was die App
 * fachlich anders machen wuerde — was fehlt, fehlt in jsdom, nicht im Browser.
 */

vi.mock("next/navigation", async () => {
  const { nextNavigationMock } = await import("./nextNavigationMock");
  return nextNavigationMock;
});

// ThemeProvider fragt beim ersten Effekt `prefers-color-scheme` ab. jsdom
// bringt matchMedia nicht mit — ohne Ersatz wirft jeder Render.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// recharts misst seinen Container. Ohne ResizeObserver bleibt das Diagramm
// leer statt zu werfen — die Seite drumherum bleibt also pruefbar.
if (!("ResizeObserver" in window)) {
  (window as unknown as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Der Backup-Export in den Einstellungen baut einen Blob-Download.
if (!URL.createObjectURL) {
  URL.createObjectURL = (() => "blob:test") as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = (() => {}) as unknown as typeof URL.revokeObjectURL;
}

beforeEach(() => {
  // Der Query-Client ist ein Singleton (api-client.ts) und wird von den
  // Mutationen direkt fuer invalidateQueries benutzt. Ihn pro Test zu ersetzen
  // wuerde Lese- und Schreibpfad auseinanderlaufen lassen; also derselbe
  // Client, aber mit geleertem Zwischenspeicher.
  queryClient.clear();
  // retry: 1 aus der Produktivkonfiguration wuerde jeden Fehlerfall-Test um
  // einen zweiten Anlauf verlaengern. Der Zustand "Abfrage gescheitert" ist
  // derselbe, nur schneller erreicht.
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
});

afterEach(() => {
  cleanup();
  resetNavigation();
  vi.unstubAllGlobals();
});
