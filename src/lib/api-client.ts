"use client";

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
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
    throw new Error(data.message || `Request failed: ${res.status}`);
  }
  return res;
}
