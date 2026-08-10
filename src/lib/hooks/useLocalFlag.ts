"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { isFlagSet, setFlag } from "@/lib/localFlag";

/*
 * Ein localStorage-Merker, den React lesen darf, ohne die Hydration zu brechen.
 *
 * `useState` + `useEffect` wäre der naheliegende Weg und ist genau der falsche:
 * der Server kennt localStorage nicht, also müsste ein Effect nach dem Mount
 * nachsetzen — ein setState im Effect, das React 19 zu Recht anmerkt und das
 * hier eine Kaskade auslöst. `useSyncExternalStore` ist für diesen Fall gebaut:
 * es rendert mit dem Server-Schnappschuss und holt den echten Wert direkt nach
 * der Hydration nach. Dasselbe Muster wie in useReducedMotionSafe.
 */

const listeners = new Map<string, Set<() => void>>();

function subscribeTo(key: string, onChange: () => void): () => void {
  let forKey = listeners.get(key);
  if (!forKey) {
    forKey = new Set();
    listeners.set(key, forKey);
  }
  forKey.add(onChange);

  // Ein zweiter Tab desselben Browsers schreibt denselben Schlüssel.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    forKey.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export interface LocalFlag {
  isSet: boolean;
  set: () => void;
}

/**
 * @param fallback Was gilt, wenn der Speicher nicht lesbar ist (privater Modus).
 */
export function useLocalFlag(key: string, fallback = false): LocalFlag {
  const subscribe = useCallback((onChange: () => void) => subscribeTo(key, onChange), [key]);

  const isSet = useSyncExternalStore(
    subscribe,
    () => isFlagSet(window.localStorage, key, fallback),
    // Server und Hydration: gesetzt annehmen. Beide Aufrufer blenden damit aus,
    // was sie zeigen wollen — lieber einen Wimpernschlag zu spät als ein
    // Aufblitzen, das gleich wieder verschwindet.
    () => true,
  );

  const set = useCallback(() => {
    setFlag(window.localStorage, key);
    listeners.get(key)?.forEach((listener) => listener());
  }, [key]);

  // Stabile Identität: Aufrufer hängen ihn an useCallback-Abhängigkeiten, und
  // ein bei jedem Render neues Objekt würde die dort registrierten Listener
  // jedes Mal ab- und wieder anmelden.
  return useMemo(() => ({ isSet, set }), [isSet, set]);
}
