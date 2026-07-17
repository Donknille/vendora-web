"use client";

import { useCallback, useSyncExternalStore } from "react";

// The native "storage" event only fires in OTHER tabs, so we dispatch our own
// event to notify subscribers within the same tab when a value is written.
const LOCAL_STORAGE_EVENT = "vendora:local-storage";

/**
 * A localStorage-backed string state that is SSR-safe and does not rely on a
 * setState-in-effect hydration pattern. Reads go through useSyncExternalStore
 * so the server renders `serverValue` and the client reconciles to the stored
 * value after hydration. Writes are mirrored across tabs (storage event) and
 * within the same tab (custom event).
 */
export function usePersistentState<T extends string>(
  key: string,
  serverValue: T,
  clientFallback: () => T = () => serverValue
): [T, (value: T) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (event: Event) => {
        // Ignore storage events for unrelated keys (key === null means clear()).
        if (event instanceof StorageEvent && event.key !== null && event.key !== key) {
          return;
        }
        onStoreChange();
      };
      window.addEventListener("storage", handler);
      window.addEventListener(LOCAL_STORAGE_EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(LOCAL_STORAGE_EVENT, handler);
      };
    },
    [key]
  );

  const value = useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem(key) as T | null) ?? clientFallback(),
    () => serverValue
  );

  const setValue = useCallback(
    (next: T) => {
      localStorage.setItem(key, next);
      window.dispatchEvent(new Event(LOCAL_STORAGE_EVENT));
    },
    [key]
  );

  return [value, setValue];
}
