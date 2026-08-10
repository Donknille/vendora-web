"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Store, ShoppingCart, Calculator, ArrowRight, X, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { useCurrentUserId } from "@/lib/context/AuthContext";
import { useAppQuery } from "@/lib/hooks/useAppQuery";
import { useLocalFlag } from "@/lib/hooks/useLocalFlag";
import { useReducedMotionSafe } from "@/lib/hooks/useReducedMotionSafe";
import { apiRequest, queryClient } from "@/lib/api-client";
import { ONBOARDING_KEY, TOUR_SLIDES, shouldAutoStartTour, type TourSlide } from "@/lib/onboarding";

/**
 * Die Willkommens-Erklärung: vier Karten, danach nie wieder von selbst.
 *
 * Der Merker liegt am Konto (`/api/onboarding`) und nicht nur in localStorage —
 * sonst käme die Erklärung bei jedem Gerätewechsel und jeder Neuinstallation der
 * PWA erneut. localStorage ist trotzdem dabei: es greift sofort und auch ohne
 * Netz, während die Serverantwort noch unterwegs ist.
 *
 * Ohne `open` entscheidet die Komponente selbst (Dashboard). Mit `open`/`onClose`
 * steuert die Hilfeseite sie — dort ist das Öffnen ausdrücklich gewollt und rührt
 * den Merker deshalb nicht an.
 */
export function WelcomeTour({
  open: controlledOpen,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
} = {}) {
  const { t } = useLanguage();
  const userId = useCurrentUserId();
  const reduceMotion = useReducedMotionSafe();
  const isControlled = controlledOpen !== undefined;

  const [index, setIndex] = useState(0);

  // Die Sperre dieses Geräts. Während der Hydration meldet sie „gesehen", der
  // echte Wert kommt einen Tick später — so entscheidet nichts, was der Server
  // nicht kennt, über die erste Markup.
  const seen = useLocalFlag(ONBOARDING_KEY);

  const onboarding = useAppQuery<{ onboarded: boolean }>([userId, "/api/onboarding"], {
    enabled: !isControlled,
    staleTime: Infinity,
  });

  const complete = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding"),
    onSuccess: () => {
      queryClient.setQueryData([userId, "/api/onboarding"], { onboarded: true });
    },
    // Ein Fehlschlag bleibt folgenlos: localStorage hat den Dialog auf diesem
    // Gerät bereits stillgelegt, und ein späterer Versuch ist idempotent.
    onError: () => {},
  });

  // Kein eigener Zustand: die Sichtbarkeit ergibt sich aus dem Merker dieses
  // Geräts und dem des Kontos. Beim Schließen wird der Merker gesetzt, und der
  // Dialog verschwindet dadurch von selbst.
  const open = isControlled
    ? controlledOpen
    : shouldAutoStartTour({
        seenLocally: seen.isSet,
        serverOnboarded: onboarding.data?.onboarded,
        isLoading: onboarding.isLoading,
        isError: onboarding.isError,
      });

  const close = useCallback(() => {
    // Beim nächsten Öffnen über die Hilfeseite wieder vorn anfangen.
    setIndex(0);

    if (isControlled) {
      onClose?.();
      return;
    }
    // Jeder Ausgang zählt: Überspringen, Durchklicken, Escape, Klick daneben.
    // Fehlte er an einem davon, käme die Erklärung genau dort wieder.
    seen.set();
    complete.mutate();
  }, [isControlled, onClose, seen, complete]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, close]);

  const slides = useMemo(() => TOUR_SLIDES.map((id) => ({ id, ...SLIDE_META[id] })), []);

  if (!open) return null;

  const slide = slides[index];
  const isLast = index === slides.length - 1;
  const copy = t.help.tour[slide.id];
  const Icon = slide.icon;
  const cta = "cta" in copy ? copy.cta : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t.help.title}
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-line bg-surface p-6 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <Icon className="h-5 w-5" />
          </span>
          <button
            onClick={close}
            className="-mr-2 -mt-1 rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-secondary"
            aria-label={t.help.tour.skip}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={reduceMotion ? false : { opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <h2 className="mt-4 text-xl font-bold text-primary font-display">{copy.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-faint">{copy.body}</p>
            {cta && (
              <Link
                href={slide.href}
                onClick={close}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
              >
                {cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {slides.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-brand-primary" : "w-1.5 bg-line"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-faint transition-colors hover:bg-elevated hover:text-secondary"
              >
                {t.help.tour.back}
              </button>
            )}
            {!isLast && !isControlled && (
              <button
                onClick={close}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-elevated hover:text-secondary"
              >
                {t.help.tour.skip}
              </button>
            )}
            <button
              onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
              className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90"
            >
              {isLast ? t.help.tour.done : t.help.tour.next}
            </button>
          </div>
        </div>

        <p className="sr-only">
          {t.help.tour.stepOf
            .replace("{current}", String(index + 1))
            .replace("{total}", String(slides.length))}
        </p>
      </div>
    </div>
  );
}

/** Symbol und Ziel je Slide; die Texte kommen aus i18n, die Reihenfolge aus onboarding.ts. */
const SLIDE_META: Record<TourSlide, { icon: LucideIcon; href: string }> = {
  welcome: { icon: Sparkles, href: "/dashboard" },
  markets: { icon: Store, href: "/markets" },
  orders: { icon: ShoppingCart, href: "/orders" },
  taxes: { icon: Calculator, href: "/steuer" },
};
