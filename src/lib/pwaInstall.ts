// Wie Bilanz-Buddy auf den Startbildschirm kommt — die Entscheidung, was angeboten
// wird, als reine Funktionen ohne Browser-APIs, damit sie unter Vitest laufen.
//
// Manifest, Service Worker und Icons existieren längst; was fehlte, war der
// sichtbare Weg dorthin. Der sieht je nach Plattform anders aus: Chrome liefert
// ein `beforeinstallprompt`-Ereignis, mit dem sich der native Dialog öffnen
// lässt, Safari auf iOS liefert grundsätzlich keines — dort bleibt nur die
// Anleitung über das Teilen-Menü.

/**
 * `BeforeInstallPromptEvent` fehlt in lib.dom (kein Standard, nur Chromium).
 * Deshalb hier deklariert statt mit `any` umgangen.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallPlatform =
  /** Chromium hat ein Installationsereignis geliefert — Knopf anbieten. */
  | "prompt"
  /** iOS/iPadOS-Safari — nur die Anleitung über „Teilen" hilft. */
  | "ios"
  /** Läuft bereits als installierte App. */
  | "installed"
  /** Weder noch: Hinweis auf das Browsermenü. */
  | "unsupported";

export const INSTALL_HINT_DISMISSED_KEY = "bilanz-buddy-install-hint-v1";

export interface PlatformProbe {
  /** display-mode: standalone bzw. navigator.standalone. */
  isStandalone: boolean;
  /** Ein beforeinstallprompt-Ereignis liegt vor. */
  hasPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}

/**
 * iPadOS ab 13 meldet sich als „Macintosh". Ohne die Touchpunkt-Prüfung bekämen
 * iPad-Nutzer:innen den Satz übers Browsermenü zu sehen, den es dort nicht gibt.
 */
function isIosLike(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function detectPlatform({
  isStandalone,
  hasPrompt,
  userAgent,
  maxTouchPoints,
}: PlatformProbe): InstallPlatform {
  // Zuerst: läuft die App schon installiert? Chrome feuert in einem
  // installierten Fenster kein beforeinstallprompt mehr, aber die Reihenfolge
  // hier soll nicht davon abhängen.
  if (isStandalone) return "installed";
  if (hasPrompt) return "prompt";
  if (isIosLike(userAgent, maxTouchPoints)) return "ios";
  return "unsupported";
}

export interface InstallHintState {
  platform: InstallPlatform;
  /** Der Balken wurde schon einmal weggeklickt. */
  dismissed: boolean;
  /** Mindestens ein Markt oder Auftrag existiert. */
  hasData: boolean;
}

/**
 * Der einmalige Hinweis im Dashboard.
 *
 * Er wartet auf echte Nutzung statt auf eine Frist: wer noch nichts angelegt
 * hat, wird gerade erst mit der App warm und bekommt bereits die
 * Willkommenskarte zu sehen. Kein Datumsrechnen, keine Zeitzonenfallen.
 */
export function shouldShowInstallHint({
  platform,
  dismissed,
  hasData,
}: InstallHintState): boolean {
  if (dismissed) return false;
  if (!hasData) return false;
  return platform === "prompt" || platform === "ios";
}
