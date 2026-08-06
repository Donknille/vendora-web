import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useAuthState } from "@/lib/context/AuthContext";

/**
 * Whether a user-scoped read should still show its loading state.
 *
 * Exists as a pure function because it encodes the bug this module was written
 * to fix. React Query defines `isLoading = isPending && isFetching`, so a
 * *disabled* query reports `isLoading === false` even though it holds no data.
 * Every read here is gated on `!!userId`, so during the session lookup the
 * pages saw `isLoading === false` + `data === undefined` and fell through to
 * their empty state — "Noch keine Ausgaben" on top of six real expenses,
 * 0,00 € across a populated EÜR.
 *
 * A read is settled only once the session is known AND (the query is disabled
 * for a reason unrelated to the session, or it has actually resolved).
 */
export function isReadLoading(state: {
  isSessionPending: boolean;
  enabled: boolean;
  isPending: boolean;
}): boolean {
  return state.isSessionPending || (state.enabled && state.isPending);
}

/**
 * Shared wrapper for every user-scoped read in the app.
 *
 * The query function comes from the global default in `api-client.ts`, which
 * derives the URL from the query key.
 */
export function useAppQuery<T>(
  queryKey: readonly unknown[],
  opts: {
    enabled?: boolean;
    /** Only needed when the key holds more than one "/api/…" segment. */
    queryFn?: () => Promise<T>;
    staleTime?: number;
  } = {}
): UseQueryResult<T, Error> {
  const { userId, isSessionPending } = useAuthState();
  const enabled = (opts.enabled ?? true) && !!userId;

  const query = useQuery<T>({
    queryKey,
    enabled,
    ...(opts.queryFn ? { queryFn: opts.queryFn } : {}),
    ...(opts.staleTime !== undefined ? { staleTime: opts.staleTime } : {}),
  });

  return {
    ...query,
    isLoading: isReadLoading({
      isSessionPending,
      enabled,
      isPending: query.isPending,
    }),
  } as UseQueryResult<T, Error>;
}
