"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/context/LanguageContext";
import { authSubmit, inputAuth } from "@/lib/styles";

const COOLDOWN_SECONDS = 60;

/**
 * Ziel des Bestaetigungslinks. Muss ueberall derselbe Wert sein -- sowohl bei
 * der Registrierung als auch beim Neuversand -- sonst landet der Nutzer je
 * nach Weg auf einer anderen Seite.
 */
export const VERIFY_CALLBACK_URL = "/auth/verify-email";

/**
 * Loest den Versand der Bestaetigungsmail aus.
 *
 * Wird an zwei Stellen gebraucht: direkt nach der Registrierung und beim
 * Neuversand. Dass die Registrierung das selbst tun muss statt Better Auths
 * `sendOnSignUp` zu nutzen, ist ausfuehrlich in src/lib/auth.ts begruendet --
 * kurz: der dortige Pfad ruft `ctx.request.clone()` ausserhalb jeder
 * Fehlerbehandlung auf und laesst die Registrierung sporadisch mit 500 enden.
 *
 * Wirft nie: der Endpunkt antwortet aus Schutz gegen Adress-Enumeration
 * ohnehin immer positiv, und ein gescheiterter Versand darf die Registrierung
 * nicht abbrechen -- dafuer gibt es den "Erneut senden"-Knopf.
 */
export async function requestVerificationEmail(email: string): Promise<void> {
  await authClient.sendVerificationEmail({ email, callbackURL: VERIFY_CALLBACK_URL });
}

interface ResendVerificationProps {
  /**
   * Bereits bekannte Adresse (Registrierung, Login). Fehlt sie -- etwa wenn der
   * Nutzer Stunden spaeter auf einen abgelaufenen Link klickt -- fragt die
   * Komponente selbst danach.
   */
  email?: string;
  variant?: "primary" | "subtle";
}

/**
 * Neuversand der Bestaetigungsmail.
 *
 * Das ist keine Bequemlichkeitsfunktion: Better Auth verschluckt Fehler beim
 * Mailversand (runInBackgroundOrAwait loggt nur), eine Registrierung sieht also
 * auch dann erfolgreich aus, wenn nie eine Mail rausging. Ohne diesen Knopf
 * haette die Nutzerin in dem Fall keinen Weg zurueck.
 */
export function ResendVerification({ email: knownEmail, variant = "primary" }: ResendVerificationProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState(knownEmail ?? "");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Jeder Tick plant den naechsten; der Cleanup raeumt den offenen Timer beim
  // Unmount ab, damit kein setState auf einer verschwundenen Komponente landet.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0 || !email) return;

    setLoading(true);
    // Bewusst ohne Fehlerauswertung: der Endpunkt antwortet aus Schutz gegen
    // Adress-Enumeration immer positiv. Wir koennen also nichts anderes
    // behaupten als "abgeschickt" -- alles andere waere geraten.
    await requestVerificationEmail(email);
    setSent(true);
    setCooldown(COOLDOWN_SECONDS);
    setLoading(false);
  };

  const buttonClass =
    variant === "primary"
      ? authSubmit
      : // Die Umriss-Variante gibt es nur hier, deshalb bleibt sie vor Ort.
        "w-full border border-brand-primary/40 hover:bg-brand-primary/10 disabled:opacity-50 text-brand-primary font-medium py-2.5 rounded-lg transition";

  const label = knownEmail ? t.auth.resendVerification : t.auth.requestNewLink;

  return (
    <form onSubmit={handleResend} className="space-y-3">
      {sent && (
        <p className="text-sm text-brand-primary text-center">{t.auth.resendSent}</p>
      )}

      {!knownEmail && (
        <div>
          <label className="block text-sm text-faint mb-1">{t.auth.email}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputAuth}
            placeholder={t.auth.emailPlaceholder}
            required
          />
        </div>
      )}

      <button type="submit" disabled={loading || cooldown > 0} className={buttonClass}>
        {cooldown > 0
          ? `${t.auth.resendIn} ${cooldown}s`
          : loading
            ? t.common.loading
            : label}
      </button>
    </form>
  );
}
