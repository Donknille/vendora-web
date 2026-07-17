"use client";

import { useEffect } from "react";

/**
 * Registers the minimal service worker (public/sw.js). Registration only runs
 * in production so it never interferes with the dev server's HMR, and is
 * deferred until after `load` so it does not compete with the initial render.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("[vendora] service worker registration failed", err);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
