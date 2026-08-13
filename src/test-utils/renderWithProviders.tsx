import { render, type RenderResult } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { queryClient } from "@/lib/api-client";
import { AuthUserSeed } from "@/lib/context/AuthContext";
import { LanguageProvider } from "@/lib/context/LanguageContext";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import type { Language } from "@/lib/prefs";
import { setRoute } from "./nextNavigationMock";

export const TEST_USER_ID = "test-user";

/**
 * Rendert eine Seite in derselben Kontextkette wie die App.
 *
 * Bewusst mit `AuthUserSeed` statt `AuthProvider`: Der Provider ruft
 * `authClient.useSession()` und damit das Netz. Der Seed ist genau das, was das
 * Server-Layout im Betrieb ebenfalls tut — er setzt die bereits gepruefte
 * Kennung und `isSessionPending: false`. Damit ist der Testaufbau naeher am
 * echten Ablauf als ein Mock des Auth-Clients es waere.
 */
export function renderWithProviders(
  ui: ReactElement,
  opts: {
    route?: string;
    params?: Record<string, string>;
    searchParams?: Record<string, string>;
    language?: Language;
  } = {}
): RenderResult {
  setRoute(opts.route ?? "/", opts.params ?? {}, opts.searchParams ?? {});

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthUserSeed userId={TEST_USER_ID}>
        <ThemeProvider initialTheme="light" initialDark={false}>
          <LanguageProvider initialLanguage={opts.language ?? "de"}>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthUserSeed>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
}

/** Eine Antwort, wie sie der Standard-queryFn aus api-client.ts erwartet. */
type RouteTable = Record<string, unknown>;

/**
 * Ersetzt `fetch` durch eine feste Tabelle Pfad -> Antwort.
 *
 * Der Standard-queryFn leitet die URL aus dem Abfrageschluessel ab, ein
 * Netzmock auf dieser Ebene deckt also alle Lesepfade ab. Nicht eingetragene
 * Pfade antworten mit 404 statt stillschweigend `undefined` zu liefern — ein
 * vergessener Eintrag soll im Test auffallen, nicht als Leerzustand
 * durchgehen.
 */
export function stubFetch(routes: RouteTable): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const key = Object.keys(routes).find((r) => url.startsWith(r));

    if (key === undefined) {
      return new Response(JSON.stringify({ message: `Kein Stub fuer ${url}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(routes[key]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
