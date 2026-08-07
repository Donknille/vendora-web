"use client";

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      // Der Standard-gcTime von 5 Minuten haette den persistierten
      // Marktmodus-Puffer wieder ausgeraeumt: sobald eine Abfrage keinen
      // Beobachter mehr hat, entfernt der Sammler sie, und das loest sofort ein
      // erneutes Schreiben nach localStorage aus -- ohne diese Eintraege. Nach
      // dem Schliessen der Kasse waere der Offline-Vorrat nach fuenf Minuten weg.
      gcTime: 7 * 24 * 60 * 60 * 1000, // eine Woche, wie OFFLINE_CACHE_MAX_AGE
      retry: 1,
      queryFn: async ({ queryKey }) => {
        // Support user-scoped keys like [userId, "/api/orders"] — find the URL element
        const url = queryKey.find(
          (k): k is string => typeof k === "string" && k.startsWith("/api/")
        ) as string;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `Request failed: ${res.status}`);
        }
        return res.json();
      },
    },
  },
});

export async function apiRequest(method: string, url: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Der Fehlercode wird mitgetragen: die Oberflaeche soll bekannte Faelle
    // uebersetzt anzeigen und darf nicht auf Textvergleiche angewiesen sein.
    const error: Error & { code?: string; status?: number } = new Error(
      data.message || `Request failed: ${res.status}`,
    );
    error.code = typeof data.code === "string" ? data.code : undefined;
    error.status = res.status;
    throw error;
  }
  return res;
}
