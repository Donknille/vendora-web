"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/context/LanguageContext";
import { ResendVerification } from "@/components/auth/ResendVerification";

/**
 * Landeseite des Bestaetigungslinks.
 *
 * Better Auth verarbeitet den Token selbst unter GET /api/auth/verify-email und
 * leitet anschliessend hierher weiter: im Erfolgsfall ohne Parameter (und
 * dank autoSignInAfterVerification bereits mit Session), sonst mit
 * ?error=TOKEN_EXPIRED oder ?error=INVALID_TOKEN.
 *
 * Damit der Erfolgsfall ueberhaupt sichtbar wird, nimmt src/proxy.ts genau
 * diesen Pfad von der "eingeloggt -> weg von /auth" -Weiterleitung aus.
 */
function VerifyEmailContent() {
  const { t } = useLanguage();
  const error = useSearchParams().get("error");

  if (!error) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-8">
            <h2 className="text-xl font-bold text-primary mb-2">{t.auth.verifiedTitle}</h2>
            <p className="text-faint">{t.auth.verifiedBody}</p>
          </div>

          <Link
            href="/dashboard"
            className="mt-6 block w-full bg-brand-primary hover:bg-brand-primary/90 text-white font-medium py-3 rounded-lg transition"
          >
            {t.auth.toDashboard}
          </Link>
        </div>
      </div>
    );
  }

  const expired = error === "TOKEN_EXPIRED";

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold text-primary mb-2">
            {expired ? t.auth.linkExpiredTitle : t.auth.invalidLinkTitle}
          </h2>
          <p className="text-faint">
            {expired ? t.auth.linkExpiredBody : t.auth.invalidLinkBody}
          </p>
        </div>

        <div className="mt-6">
          <ResendVerification />
        </div>

        <p className="mt-6 text-center">
          <Link href="/auth/login" className="text-brand-primary hover:text-brand-primary/80 text-sm">
            {t.auth.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
