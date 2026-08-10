import { describe, it, expect } from "vitest";
import { ONBOARDING_KEY, TOUR_SLIDES, shouldAutoStartTour, type TourVisibility } from "@/lib/onboarding";
import { isFlagSet, setFlag } from "@/lib/localFlag";

/** Minimaler Storage-Ersatz; optional so, dass jeder Zugriff wirft. */
function fakeStorage({ throws = false }: { throws?: boolean } = {}): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => {
      if (throws) throw new Error("access denied");
      return map.get(key) ?? null;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => {
      if (throws) throw new Error("access denied");
      map.set(key, value);
    },
  };
}

const base: TourVisibility = {
  seenLocally: false,
  serverOnboarded: false,
  isLoading: false,
  isError: false,
};

describe("shouldAutoStartTour", () => {
  it("startet die Tour für ein Konto, das sie noch nie gesehen hat", () => {
    expect(shouldAutoStartTour(base)).toBe(true);
  });

  it("startet sie nicht erneut, wenn sie auf diesem Gerät schon lief", () => {
    expect(shouldAutoStartTour({ ...base, seenLocally: true })).toBe(false);
  });

  it("startet sie auf einem neuen Gerät nicht, wenn das Konto sie kennt", () => {
    // Der Fall, an dem ein reiner localStorage-Merker scheitern würde:
    // neuer Browser, geleerter Speicher, frisch installierte PWA.
    expect(shouldAutoStartTour({ ...base, seenLocally: false, serverOnboarded: true })).toBe(
      false,
    );
  });

  it("wartet, solange der Serverwert noch geladen wird", () => {
    expect(shouldAutoStartTour({ ...base, isLoading: true, serverOnboarded: undefined })).toBe(
      false,
    );
  });

  it("zeigt sie ohne Netz nicht — im Zweifel lieber gar nicht", () => {
    expect(shouldAutoStartTour({ ...base, isError: true, serverOnboarded: undefined })).toBe(
      false,
    );
  });

  it("zeigt sie nicht, solange der Serverwert unbekannt ist", () => {
    expect(shouldAutoStartTour({ ...base, serverOnboarded: undefined })).toBe(false);
  });
});

describe("lokaler Merker", () => {
  it("merkt sich den Abschluss unter dem versionierten Schlüssel", () => {
    const storage = fakeStorage();
    expect(isFlagSet(storage, ONBOARDING_KEY)).toBe(false);

    setFlag(storage, ONBOARDING_KEY);

    expect(storage.getItem(ONBOARDING_KEY)).not.toBeNull();
    expect(isFlagSet(storage, ONBOARDING_KEY)).toBe(true);
  });

  it("kommt ohne Storage aus (Server, privater Modus)", () => {
    expect(isFlagSet(null, ONBOARDING_KEY)).toBe(false);
    expect(() => setFlag(null, ONBOARDING_KEY)).not.toThrow();
  });

  it("stürzt nicht ab, wenn der Zugriff selbst wirft", () => {
    const hostile = fakeStorage({ throws: true });
    expect(isFlagSet(hostile, ONBOARDING_KEY)).toBe(false);
    expect(() => setFlag(hostile, ONBOARDING_KEY)).not.toThrow();
  });

  it("lässt den Aufrufer entscheiden, was ohne Speicher gilt", () => {
    // Der Installationshinweis will dann lieber ausbleiben, die Tour nicht.
    expect(isFlagSet(null, "x", true)).toBe(true);
    expect(isFlagSet(fakeStorage({ throws: true }), "x", true)).toBe(true);
  });
});

describe("TOUR_SLIDES", () => {
  it("führt in der erwarteten Reihenfolge durch die drei Säulen", () => {
    expect(TOUR_SLIDES).toEqual(["welcome", "markets", "orders", "taxes"]);
  });

  it("enthält keine Kennung doppelt", () => {
    expect(new Set(TOUR_SLIDES).size).toBe(TOUR_SLIDES.length);
  });
});
