"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/api-client";

interface AuthState {
  userId: string | null;
  /** True while the client-side session lookup is still in flight. */
  isSessionPending: boolean;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  isSessionPending: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // Clear stale React Query cache when the user changes (sign-out or account switch)
    if (lastUserId.current !== null && lastUserId.current !== userId) {
      queryClient.clear();
    }
    lastUserId.current = userId;
  }, [userId]);

  const value = useMemo(
    () => ({ userId, isSessionPending: isPending }),
    [userId, isPending]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Seeds the user id that the server layout already validated.
 *
 * Without this, every page inside (app) waits for the client-side
 * /api/auth/get-session round-trip before `userId` is known. All data hooks are
 * gated on `enabled: !!userId`, and a *disabled* React Query reports
 * `isLoading === false` (it is defined as `isPending && isFetching`) while its
 * data is still undefined — so the pages skipped their skeleton and rendered an
 * empty state, or 0,00 €, over real data.
 *
 * Once the client session resolves it takes over, so signing out still works.
 */
export function AuthUserSeed({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const outer = useContext(AuthContext);

  const value = useMemo(
    () => ({
      userId: outer.isSessionPending ? userId : outer.userId,
      isSessionPending: false,
    }),
    [outer.isSessionPending, outer.userId, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState(): AuthState {
  return useContext(AuthContext);
}

export function useCurrentUserId(): string | null {
  return useContext(AuthContext).userId;
}
