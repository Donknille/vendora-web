"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLanguage } from "@/lib/context/LanguageContext";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * Läuft beim Bestätigen. Ein `throw` hält den Dialog offen und zeigt die
   * Fehlermeldung an; wer den Dialog nach Erfolg schließen will, ruft in
   * `onConfirm` selbst `onClose` bzw. setzt `open` auf false.
   */
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const messageId = useId();
  // Escape liest den aktuellen Ladezustand über eine Ref, damit der Listener
  // nicht bei jedem Zustandswechsel neu registriert werden muss.
  const loadingRef = useRef(false);
  loadingRef.current = loading;

  // Der Dialog bleibt zwischen zwei Öffnungen gemountet (`open` false rendert
  // nur nichts). Deshalb muss der Zustand beim Öffnen frisch sein: Vorher blieb
  // `loading` nach einem ERFOLGREICHEN Bestätigen auf true stehen — der zweite
  // Dialog auf derselben Seite öffnete mit zwei toten Knöpfen und blockiertem
  // Escape. Beim Account-Löschen konnte man nicht einmal mehr abbrechen.
  useEffect(() => {
    if (!open) return;
    setLoading(false);
    setError("");

    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!loadingRef.current) onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        // Fokus bleibt im Dialog (WAI-ARIA "modal"): Tab am Ende springt an
        // den Anfang, Shift+Tab am Anfang ans Ende.
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    setError("");
    setLoading(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t.common.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError("");
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="w-full max-w-sm mx-4 rounded-xl bg-surface border border-line p-6 shadow-xl"
      >
        <h3 id={titleId} className="text-lg font-semibold text-primary">
          {title}
        </h3>
        <p id={messageId} className="mt-2 text-sm text-faint whitespace-pre-line">
          {message}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-faint hover:text-secondary hover:bg-elevated transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {cancelText ?? t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {loading ? "..." : (confirmText ?? t.common.confirm)}
          </button>
        </div>
      </div>
    </div>
  );
}
