import { vi } from "vitest";

/**
 * Veraenderlicher Zustand hinter dem `next/navigation`-Mock.
 *
 * Die Seiten im (app)-Bereich lesen Route-Parameter (`useParams`) und
 * navigieren nach dem Speichern (`useRouter().push`). Ausserhalb des
 * Next-Routers gibt es beides nicht — ohne Mock wirft schon der erste Render.
 *
 * Der Zustand liegt in einem eigenen Modul, weil `vi.mock` in der Setup-Datei
 * ausgewertet wird, die Tests ihn aber pro Fall setzen muessen.
 */
export const navigationState = {
  pathname: "/",
  params: {} as Record<string, string>,
  /**
   * Suchparameter der Route. Ohne die rendert `/auth/update-password` seinen
   * "Link ungueltig"-Zweig statt des Formulars — es gibt Seiten, deren
   * eigentlicher Inhalt an der Query haengt.
   */
  searchParams: {} as Record<string, string>,
};

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

/** Setzt Pfad, Route-Parameter und Suchparameter fuer den naechsten Render. */
export function setRoute(
  pathname: string,
  params: Record<string, string> = {},
  searchParams: Record<string, string> = {}
): void {
  navigationState.pathname = pathname;
  navigationState.params = params;
  navigationState.searchParams = searchParams;
}

/** Zuruecksetzen zwischen zwei Tests — sonst leckt ein `push` in den naechsten. */
export function resetNavigation(): void {
  navigationState.pathname = "/";
  navigationState.params = {};
  navigationState.searchParams = {};
  for (const fn of Object.values(routerMock)) fn.mockClear();
}

export const nextNavigationMock = {
  useRouter: () => routerMock,
  usePathname: () => navigationState.pathname,
  useParams: () => navigationState.params,
  useSearchParams: () => new URLSearchParams(navigationState.searchParams),
  redirect: vi.fn(),
  notFound: vi.fn(),
};
