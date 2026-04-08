"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });

    if (resetError) {
      setError("Reset-Link konnte nicht gesendet werden. Bitte versuche es erneut.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8">
            <h2 className="text-xl font-bold text-white mb-2">E-Mail gesendet</h2>
            <p className="text-zinc-400">
              Prüfe dein E-Mail-Postfach für einen Link zum Zurücksetzen deines Passworts.
            </p>
          </div>
          <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 text-sm mt-4 inline-block">
            Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Passwort zurücksetzen</h1>
          <p className="text-zinc-400 mt-2">
            Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link.
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="deine@email.de"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
          >
            {loading ? "Wird gesendet..." : "Reset-Link senden"}
          </button>
        </form>

        <p className="mt-6 text-center text-zinc-500 text-sm">
          <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300">
            Zurück zum Login
          </Link>
        </p>
      </div>
    </div>
  );
}
