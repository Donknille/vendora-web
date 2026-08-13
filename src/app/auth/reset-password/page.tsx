"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/context/LanguageContext";
import { authSubmit, errorBox, inputAuth } from "@/lib/styles";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/auth/update-password",
    });

    if (resetError) {
      setError(t.auth.resetError);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-8">
            <h2 className="text-xl font-bold text-primary mb-2">{t.auth.emailSentTitle}</h2>
            <p className="text-faint">{t.auth.resetSuccessMessage}</p>
          </div>
          <Link href="/auth/login" className="text-brand-primary hover:text-brand-primary/80 text-sm mt-4 inline-block">
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
          <h1 className="text-3xl font-bold text-primary font-display">{t.auth.resetTitle}</h1>
          <p className="text-faint mt-2">{t.auth.resetEmailSubtitle}</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className={authSubmit}
          >
            {loading ? t.common.loading : t.auth.sendResetLink}
          </button>
        </form>

        <p className="mt-6 text-center text-muted text-sm">
          <Link href="/auth/login" className="text-brand-primary hover:text-brand-primary/80">
            {t.auth.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
