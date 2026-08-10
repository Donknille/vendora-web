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

export default function RegisterPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
            <img src="/vendora_logo_v1_transparent.png" alt="Vendora" className="h-12 w-auto block dark:hidden" />
            <img src="/vendora_logo_v2_transparent.png" alt="Vendora" className="h-12 w-auto hidden dark:block" />
          </div>
          <p className="text-faint mt-2">{t.auth.registerSubtitle}</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-faint mb-1">{t.auth.email}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-primary transition"
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
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-primary transition"
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
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-primary transition"
              placeholder={t.auth.confirmPasswordPlaceholder}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
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
