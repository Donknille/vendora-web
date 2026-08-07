"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/api-client";

interface AuthState {
  userId: string | null;
  /** True while the client-side session lookup is still in flight. */
  isSessionPending: boolean;
  /** True when the session lookup failed (offline) rather than returned "no session". */
  sessionUnavailable?: boolean;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  isSessionPending: true,
  sessionUnavailable: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  // Ohne Netz schlaegt der Session-Abruf fehl und liefert data: null bei
  // isPending: false. Das ist etwas anderes als "nicht angemeldet" und darf die
  // vom Server geseedete Kennung nicht verdraengen -- sonst laufen alle
  // Abfrageschluessel auf [null, ...] und der persistierte Offline-Vorrat, der
  // unter der echten Kennung liegt, waere unerreichbar.
  // Nur ein echter Transportfehler zaehlt. Ein 401 traegt ebenfalls einen
  // error, bedeutet aber "nicht mehr angemeldet": wuerde man da die geseedete
  // Kennung behalten, bliebe ein Tab nach dem Abmelden auf einem anderen Geraet
  // optisch angemeldet und zeigte weiter alte Daten.
  const errorStatus =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: number }).status
      : undefined;
  // Auf den WERT pruefen, nicht auf die Existenz: der Fetch-Client haengt an
  // jeden nicht-ok-Fehler einen status. Nur 401 heisst "nicht mehr angemeldet";
  // ein 429 (zwei Geraete hinter derselben IP) oder ein 500 haetten sonst die
  // geseedete Kennung verworfen -- und damit leere Listen und 0,00 Euro ueber
  // echten Daten erzeugt.
  const sessionUnavailable = !!error && !session && errorStatus !== 401;
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // Clear stale React Query cache when the user changes (sign-out or account switch)
    if (lastUserId.current !== null && lastUserId.current !== userId) {
      queryClient.clear();
    }
    lastUserId.current = userId;
  }, [userId]);

  const value = useMemo(
    () => ({ userId, isSessionPending: isPending, sessionUnavailable }),
    [userId, isPending, sessionUnavailable]
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
      userId:
        outer.isSessionPending || outer.sessionUnavailable ? userId : outer.userId,
      isSessionPending: false,
    }),
    [outer.isSessionPending, outer.sessionUnavailable, outer.userId, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState(): AuthState {
  return useContext(AuthContext);
}

export function useCurrentUserId(): string | null {
  return useContext(AuthContext).userId;
}
