import { describe, it, expect, vi, beforeEach } from "vitest";

// Auth + storage sind gemockt (keine DB). Geprueft wird das Auth-Gate und dass
// der Merker wirklich am Konto landet — ohne den POST bliebe die Erklaerung an
// localStorage haengen und kaeme auf jedem neuen Geraet wieder.
const authState = { userId: "user1" as string | null };
const storageState = { onboarded: false, marks: 0 };

vi.mock("@/lib/server/auth", () => ({
  getAuthUserId: async () => authState.userId,
  requireActiveSubscription: async () => null,
}));

vi.mock("@/lib/server/storage", () => ({
  hasCompletedOnboarding: async () => storageState.onboarded,
  markOnboardingComplete: async () => {
    storageState.marks += 1;
    storageState.onboarded = true;
  },
}));

import { GET, POST } from "@/app/api/onboarding/route";

// Next.js ruft einen Route Handler immer mit einem Request auf. Die Tests
// kamen bisher ohne aus, weil die Handler als parameterlose Funktionen
// geschrieben waren; seit sie durch withAuth laufen, verlangt die Signatur ihn.
// Die Zusicherungen darunter sind unveraendert -- sie sind der Vertrag, die
// Aufrufkonvention ist es nicht.
const req = () => new Request("http://localhost/api/onboarding");

describe("/api/onboarding", () => {
  beforeEach(() => {
    authState.userId = "user1";
    storageState.onboarded = false;
    storageState.marks = 0;
  });

  it("meldet ein Konto, das die Erklaerung noch nicht kennt", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ onboarded: false });
  });

  it("haelt den Abschluss am Konto fest", async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ onboarded: true });
    expect(storageState.marks).toBe(1);

    // Der naechste Aufruf — neues Geraet, neuer Browser — sieht es sofort.
    await expect((await GET(req())).json()).resolves.toEqual({ onboarded: true });
  });

  it("antwortet ohne Session mit 401", async () => {
    authState.userId = null;
    expect((await GET(req())).status).toBe(401);
    expect((await POST(req())).status).toBe(401);
    expect(storageState.marks).toBe(0);
  });
});
