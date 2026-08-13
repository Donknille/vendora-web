"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/context/LanguageContext";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { authSubmit, errorBox, inputAuth } from "@/lib/styles";

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notVerified, setNotVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotVerified(false);
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    });

    if (authError) {
      // Der Sonderfall muss raus aus der Sammelmeldung: Better Auth antwortet
      // bei unbestaetigter Adresse mit 403 EMAIL_NOT_VERIFIED, und zwar erst
      // NACH erfolgreicher Passwortpruefung. Ohne die Unterscheidung liest
      // jemand mit korrektem Passwort "Ungueltige E-Mail oder Passwort" und
      // landet im Passwort-Reset -- der das Problem nicht loest.
      if (authError.code === "EMAIL_NOT_VERIFIED") {
        setNotVerified(true);
      } else {
        setError(t.auth.loginError);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <img src="/vendora_logo_v1_transparent.png" alt="Vendora" className="h-12 w-auto block dark:hidden" />
            <img src="/vendora_logo_v2_transparent.png" alt="Vendora" className="h-12 w-auto hidden dark:block" />
          </div>
          <p className="text-faint mt-2">{t.auth.loginSubtitle}</p>
        </div>

        {notVerified && (
          <div className="mb-6 bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-6">
            <h2 className="font-bold text-primary mb-1">{t.auth.emailNotVerifiedTitle}</h2>
            <p className="text-faint text-sm">{t.auth.emailNotVerifiedBody}</p>
            <div className="mt-4">
              <ResendVerification email={email} variant="subtle" />
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="deine@email.de"
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
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={authSubmit}
          >
            {loading ? t.common.loading : t.auth.login}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link href="/auth/reset-password" className="text-sm text-brand-primary hover:text-brand-primary/80">
            {t.auth.forgotPassword}
          </Link>
          <p className="text-muted text-sm">
            {t.auth.noAccount}{" "}
            <Link href="/auth/register" className="text-brand-primary hover:text-brand-primary/80">
              {t.auth.register}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
