"use client";

import { useSyncExternalStore } from "react";
import { Share, X, Plus } from "lucide-react";

const DISMISS_KEY = "vendora_ios_hint_dismissed";
const DISMISS_EVENT = "vendora:ios-hint-dismissed";

interface IosNavigator extends Navigator {
  standalone?: boolean;
}

/** True only on iOS Safari, not already installed (standalone), not dismissed. */
function shouldShow(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  if (localStorage.getItem(DISMISS_KEY) === "1") return false;

  const standalone =
    (navigator as IosNavigator).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (standalone) return false;

  const ua = navigator.userAgent;
  const isIOS =
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /safari/i.test(ua) && !/(crios|fxios|edgios|opios)/i.test(ua);
  return isIOS && isSafari;
}

function subscribe(onChange: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", onChange);
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    window.removeEventListener(DISMISS_EVENT, onChange);
  };
}

export function IosInstallHint() {
  const visible = useSyncExternalStore(subscribe, shouldShow, () => false);
  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-xl">
      <div className="flex items-start gap-3">
        {/* Plain <img> on purpose: next/Image routes through /_next/image, which
            needs the network; the precached icon must render offline too. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">Vendora installieren</p>
          <p className="mt-1 text-xs text-secondary">
            Tippe auf{" "}
            <Share className="inline h-3.5 w-3.5 align-text-bottom text-brand-primary" />{" "}
            <span className="font-medium">Teilen</span> und dann auf{" "}
            <Plus className="inline h-3.5 w-3.5 align-text-bottom text-brand-primary" />{" "}
            <span className="font-medium">Zum Home-Bildschirm</span>, um Vendora wie
            eine App zu nutzen — auch offline im Marktmodus.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-faint hover:bg-elevated hover:text-secondary transition-colors"
          aria-label="Hinweis schließen"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
