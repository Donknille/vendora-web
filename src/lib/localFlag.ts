// Ein Ja/Nein-Merker in localStorage — als reine Funktionen, damit sie ohne DOM
// testbar bleiben.
//
// `Storage | null` statt eines direkten `localStorage`-Zugriffs: im privaten
// Modus mancher Browser wirft schon das Lesen, und auf dem Server gibt es das
// Objekt gar nicht. Was in diesem Fall gelten soll, entscheidet der Aufrufer
// über `fallback` — für den einen Merker ist „unbekannt" harmlos, für den
// anderen soll dann lieber nichts erscheinen.

export function isFlagSet(
  storage: Storage | null | undefined,
  key: string,
  fallback = false,
): boolean {
  if (!storage) return fallback;
  try {
    return storage.getItem(key) !== null;
  } catch {
    return fallback;
  }
}

export function setFlag(storage: Storage | null | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, "1");
  } catch {
    // Kein Speicher verfügbar — der Aufrufer muss ohne ihn auskommen.
  }
}
