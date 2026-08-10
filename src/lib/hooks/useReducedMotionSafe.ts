"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Reduced-motion preference that is safe to branch on during render.
 *
 * framer-motion's own `useReducedMotion` seeds `useState` from `matchMedia`
 * synchronously (see node_modules/framer-motion/…/use-reduced-motion.mjs), so
 * the server renders `null` while the first client render already says `true` —
 * a hydration mismatch on every load for anyone with Reduced Motion enabled.
 *
 * `useSyncExternalStore` exists for exactly this: React uses the server
 * snapshot while hydrating and only then re-renders with the real value, so the
 * markup lines up and the preference is still honoured a tick later.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false, // server + hydration: assume motion is allowed
  );
}
