"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/context/LanguageContext";
import {
  ResendVerification,
  VERIFY_CALLBACK_URL,
  requestVerificationEmail,
} from "@/components/auth/ResendVerification";
import { authSubmit, errorBox, inputAuth } from "@/lib/styles";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }

    // Das `required` am Feld faengt den Normalfall bereits im Browser ab. Diese
    // Pruefung steht daneben, weil die Registrierung der Zeitpunkt des
    // Vertragsschlusses ist: AGB, Datenschutzerklaerung und der AVV nach
    // Art. 28 DSGVO kommen hier zustande, sonst nirgends.
    if (!consent) {
      setError(t.auth.consentRequired);
      return;
    }

    setLoading(true);

    const { data, error: authError } = await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0] || email,
      // Ohne callbackURL landet der Nutzer nach dem Klick auf "/" statt auf der
      // Bestaetigungsseite -- Better Auth defaultet darauf.
      callbackURL: VERIFY_CALLBACK_URL,
    });

    if (authError) {
      // Better Auth antwortet englisch ("User already exists..."). Der haeufigste
      // Fall bekommt deshalb den uebersetzten Text; alles andere wird
      // durchgereicht, damit keine Ursache verlorengeht.
      setError(
        authError.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? t.auth.registerError
          : authError.message || t.auth.registerError
      );
      setLoading(false);
      return;
    }

    // Mit requireEmailVerification: true liefert Better Auth hier immer
    // token: null. Der Zweig bleibt als Absicherung stehen, falls die Pflicht
    // je wieder abgeschaltet wird -- sonst haenge der Nutzer auf einem
    // "Postfach pruefen"-Bildschirm fest, obwohl er laengst angemeldet ist.
    if (data?.token) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Der Versand haengt bewusst hier und nicht an Better Auths sendOnSignUp --
    // Begruendung in src/lib/auth.ts (dessen Pfad laesst die Registrierung
    // sporadisch mit 500 enden).
    await requestVerificationEmail(email);

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-8">
            <h2 className="text-xl font-bold text-primary mb-2">{t.auth.verifyEmailTitle}</h2>
            <p className="text-faint">
              {t.auth.verifyEmailBody} <span className="text-primary">{email}</span>.{" "}
              {t.auth.verifyEmailBodyEnd}
            </p>
            <p className="text-muted text-sm mt-4">{t.auth.verifyEmailSpamHint}</p>
          </div>

          <div className="mt-6">
            <ResendVerification email={email} variant="subtle" />
          </div>

          <Link href="/auth/login" className="text-brand-primary hover:text-brand-primary/80 text-sm mt-6 inline-block">
            {t.auth.backToLogin}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Logo className="h-12 w-auto" />
          </div>
          <p className="text-faint mt-2">{t.auth.registerSubtitle}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className={errorBox}>
              {error}
            </div>
          )}

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

          <div>
            <label className="block text-sm text-faint mb-1">{t.auth.password}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputAuth}
              placeholder={t.auth.passwordMinPlaceholder}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-faint mb-1">{t.auth.confirmPassword}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputAuth}
              placeholder={t.auth.confirmPasswordPlaceholder}
              required
            />
          </div>

          {/* Die Rechtstexte oeffnen in einem neuen Tab: wer sie im selben
              Tab aufschlaegt, kommt mit leerem Formular zurueck. */}
          <label className="flex items-start gap-3 text-sm text-faint leading-relaxed">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand-primary"
              required
            />
            <span>
              {t.auth.consentPrefix}{" "}
              <Link
                href="/legal/agb"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary hover:text-brand-primary/80"
              >
                {t.auth.consentAgb}
              </Link>{" "}
              {t.auth.consentSep}{" "}
              <Link
                href="/legal/datenschutz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary hover:text-brand-primary/80"
              >
                {t.auth.consentPrivacy}
              </Link>{" "}
              {t.auth.consentAvvPrefix}{" "}
              <Link
                href="/legal/avv"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-primary hover:text-brand-primary/80"
              >
                {t.auth.consentAvv}
              </Link>{" "}
              {t.auth.consentAvvSuffix}
            </span>
          </label>

          <button
            type="submit"
            disabled={loading || !consent}
            className={authSubmit}
          >
            {loading ? t.common.loading : t.auth.createAccount}
          </button>
        </form>

        <p className="mt-6 text-center text-muted text-sm">
          {t.auth.hasAccount}{" "}
          <Link href="/auth/login" className="text-brand-primary hover:text-brand-primary/80">
            {t.auth.login}
          </Link>
        </p>
      </div>
    </div>
  );
}
