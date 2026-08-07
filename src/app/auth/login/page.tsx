"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/context/LanguageContext";

export default function LoginPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    });

    if (authError) {
      setError(t.auth.loginError);
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

        <form onSubmit={handleLogin} className="space-y-4">
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
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-primary transition"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
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
