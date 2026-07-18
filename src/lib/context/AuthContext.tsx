"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/lib/api-client";

const AuthContext = createContext<string | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    // Clear stale React Query cache when the user changes (sign-out or account switch)
    if (lastUserId.current !== null && lastUserId.current !== userId) {
      queryClient.clear();
    }
    lastUserId.current = userId;
  }, [userId]);

  return <AuthContext.Provider value={userId}>{children}</AuthContext.Provider>;
}

export function useCurrentUserId(): string | null {
  return useContext(AuthContext);
}
