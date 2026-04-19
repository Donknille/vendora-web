"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { queryClient } from "@/lib/api-client";

const AuthContext = createContext<string | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Load initial user
    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id ?? null;
      setUserId(id);
      lastUserId.current = id;
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;

      if (event === "SIGNED_OUT") {
        queryClient.clear();
        setUserId(null);
        lastUserId.current = null;
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // If user changed (different account), clear stale cache
        if (lastUserId.current && lastUserId.current !== newUserId) {
          queryClient.clear();
        }
        setUserId(newUserId);
        lastUserId.current = newUserId;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={userId}>{children}</AuthContext.Provider>;
}

export function useCurrentUserId(): string | null {
  return useContext(AuthContext);
}
