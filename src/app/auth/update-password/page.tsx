"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/lib/context/LanguageContext";
import { authSubmit, errorBox, inputAuth } from "@/lib/styles";

function UpdatePasswordForm() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenInvalid = !token || !!searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) return;

    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.auth.passwordMismatch);
      return;
    }

    setLoading(true);

    const { error: updateError } = await authClient.resetPassword({
      newPassword: password,
      token,
    });

    if (updateError) {
      setError(t.auth.updateError);
      setLoading(false);
      return;
    }

    router.push("/auth/login");
    router.refresh();
  };

  if (tokenInvalid) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8">
            <h2 className="text-xl font-bold text-primary mb-2">{t.auth.invalidLinkTitle}</h2>
            <p className="text-faint">{t.auth.updateError}</p>
          </div>
          <Link href="/auth/reset-password" className="text-brand-primary hover:text-brand-primary/80 text-sm mt-4 inline-block">
            {t.auth.resetTitle}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary font-display">{t.auth.newPasswordTitle}</h1>
          <p className="text-faint mt-2">{t.auth.newPasswordSubtitle}</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className={errorBox}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-faint mb-1">{t.auth.newPassword}</label>
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

          <button
            type="submit"
            disabled={loading}
            className={authSubmit}
          >
            {loading ? t.common.loading : t.auth.changePassword}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}
