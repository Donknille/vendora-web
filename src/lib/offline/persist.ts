let requested = false;

/**
 * Requests persistent storage so the browser is less likely to evict the
 * offline queue and cached market data under storage pressure (Phase 3.5).
 *
 * Best-effort: the outcome is logged but never relied upon. Runs at most once
 * per session — intended to be triggered on the first market-mode start.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (requested) return false;
  requested = true;

  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) {
      console.info("[vendora] persistent storage API not available");
      return false;
    }

    if (await navigator.storage.persisted?.()) {
      console.info("[vendora] storage already persistent");
      return true;
    }

    const granted = await navigator.storage.persist();
    console.info(`[vendora] navigator.storage.persist() -> ${granted}`);
    return granted;
  } catch (err) {
    console.warn("[vendora] persistent storage request failed", err);
    return false;
  }
}
