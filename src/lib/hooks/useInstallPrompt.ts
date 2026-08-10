"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  detectPlatform,
  type BeforeInstallPromptEvent,
  type InstallPlatform,
} from "@/lib/pwaInstall";

/*
 * Zugriff auf das Installationsereignis des Browsers.
 *
 * Der Zustand liegt modulweit und nicht in einer Komponente: Chromium feuert
 * `beforeinstallprompt` genau einmal, kurz nach dem Laden — oft bevor eine
 * Komponente tief im Baum montiert ist. Ein Listener in deren `useEffect` würde
 * es dann dauerhaft verpassen, und der Installationsknopf bliebe für immer aus.
 * Registriert wird deshalb beim Import dieses Moduls.
 */

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let standalone = false;
const listeners = new Set<() => void>();

// useSyncExternalStore vergleicht Schnappschüsse per Identität. Ein bei jedem
// Aufruf neu gebautes Objekt hieße: unendliche Rerenders. Also einmal bauen und
// nur bei echter Änderung ersetzen.
let snapshot: InstallPlatform = "unsupported";

function computeSnapshot(): InstallPlatform {
  if (typeof window === "undefined") return "unsupported";
  return detectPlatform({
    isStandalone: standalone,
    hasPrompt: deferredPrompt !== null,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

function publish() {
  const next = computeSnapshot();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

function isStandaloneNow(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // Safari auf iOS kennt display-mode nicht, aber dieses nicht standardisierte Flag.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

if (typeof window !== "undefined") {
  standalone = isStandaloneNow();
  snapshot = computeSnapshot();

  window.addEventListener("beforeinstallprompt", (event) => {
    // Ohne preventDefault zeigt Chrome unter Umständen sein eigenes Banner und
    // verbraucht das Ereignis, bevor wir es anbieten können.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publish();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    standalone = true;
    publish();
  });

  // Wird die App aus dem Browser heraus installiert und dort weitergenutzt,
  // wechselt der Anzeigemodus im laufenden Tab.
  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    standalone = isStandaloneNow();
    publish();
  });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

export interface InstallPromptApi {
  platform: InstallPlatform;
  /** Öffnet den nativen Dialog; nur bei platform === "prompt" wirksam. */
  install: () => Promise<void>;
}

export function useInstallPrompt(): InstallPromptApi {
  const platform = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => "unsupported" as InstallPlatform, // Server + Hydration: nichts anbieten
  );

  const install = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // Abgebrochen oder vom Browser verweigert — nichts zu tun.
    } finally {
      // Das Ereignis ist einmalig verwendbar. Wer ablehnt, bekommt den Knopf
      // erst wieder, wenn der Browser von sich aus ein neues anbietet.
      deferredPrompt = null;
      publish();
    }
  }, []);

  return { platform, install };
}
