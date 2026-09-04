import "server-only";

// Kein Client blaettert heute; die Listen-Hooks holen eine Seite ohne
// limit/offset. 500 war fuer eine Saison Marktverkaeufe zu wenig — ab da
// zeigten Marktseite (gekappt) und Dashboard (ungekappt) verschiedene Zahlen
// fuer denselben Markt. Echtes Blaettern in der Oberflaeche ist ein eigenes
// Ticket; bis dahin liegt die Grenze weit ueber dem, was ein Konto erreicht.
export const DEFAULT_PAGE_SIZE = 5000;
export const MAX_PAGE_SIZE = 5000;

/**
 * Parses `?limit=&offset=` from a request into a bounded page window.
 * Missing/invalid values fall back to a default page size (never unbounded).
 */
export function parsePagination(request: Request): { limit: number; offset: number } {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}
