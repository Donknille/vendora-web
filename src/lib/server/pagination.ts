import "server-only";

export const DEFAULT_PAGE_SIZE = 500;
export const MAX_PAGE_SIZE = 1000;

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
