import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  shouldShowInstallHint,
  type InstallPlatform,
  type PlatformProbe,
} from "@/lib/pwaInstall";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
// iPadOS ab 13 gibt sich als Desktop-Mac aus; nur maxTouchPoints verrät es.
const IPADOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const probe = (overrides: Partial<PlatformProbe> = {}): PlatformProbe => ({
  isStandalone: false,
  hasPrompt: false,
  userAgent: DESKTOP_CHROME,
  maxTouchPoints: 0,
  ...overrides,
});

describe("detectPlatform", () => {
  it("bietet den nativen Dialog an, sobald Chromium ihn hergibt", () => {
    expect(detectPlatform(probe({ hasPrompt: true }))).toBe("prompt");
  });

  it("erkennt das iPhone, das nie ein Installationsereignis liefert", () => {
    expect(detectPlatform(probe({ userAgent: IPHONE }))).toBe("ios");
  });

  it("erkennt iPadOS trotz Macintosh-Kennung an den Touchpunkten", () => {
    expect(detectPlatform(probe({ userAgent: IPADOS, maxTouchPoints: 5 }))).toBe("ios");
  });

  it("hält einen echten Mac ohne Touch nicht für ein iPad", () => {
    expect(detectPlatform(probe({ userAgent: IPADOS, maxTouchPoints: 0 }))).toBe("unsupported");
  });

  it("meldet die laufende Installation und schlägt dabei jede andere Bedingung", () => {
    expect(
      detectPlatform(probe({ isStandalone: true, hasPrompt: true, userAgent: IPHONE })),
    ).toBe("installed");
  });

  it("fällt auf den Hinweis übers Browsermenü zurück", () => {
    expect(detectPlatform(probe())).toBe("unsupported");
  });
});

describe("shouldShowInstallHint", () => {
  const hint = (platform: InstallPlatform, dismissed = false, hasData = true) =>
    shouldShowInstallHint({ platform, dismissed, hasData });

  it("erscheint, sobald die App tatsächlich genutzt wird", () => {
    expect(hint("prompt")).toBe(true);
    expect(hint("ios")).toBe(true);
  });

  it("bleibt weg, solange noch nichts angelegt wurde", () => {
    // Dort zeigt das Dashboard bereits seine Willkommenskarte.
    expect(hint("prompt", false, false)).toBe(false);
  });

  it("kommt nach dem Wegklicken nicht wieder", () => {
    expect(hint("prompt", true)).toBe(false);
  });

  it("erscheint nicht in der bereits installierten App", () => {
    expect(hint("installed")).toBe(false);
  });

  it("erscheint nicht, wo es nichts zu installieren gibt", () => {
    expect(hint("unsupported")).toBe(false);
  });
});
