"use client";

import { useEffect } from "react";
// Seiteneffekt-Import: das Modul registriert beim Laden den Listener für
// `beforeinstallprompt`. Chromium feuert es einmalig kurz nach dem Laden, also
// bevor der Dashboard-Chunk mit dem Installationshinweis dran ist — dieser
// Registrar hängt dagegen im Root-Layout und ist rechtzeitig da.
import "@/lib/hooks/useInstallPrompt";

// Registers the service worker (public/sw.js) that powers offline app-shell
// caching for the market mode. Production only: in dev the SW competes with
// Turbopack HMR and can serve stale bundles. Renders nothing.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Registration failures are non-fatal — the app works online without it.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
