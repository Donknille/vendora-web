"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
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
      setError("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (authError) {
      setError("Konto konnte nicht erstellt werden. E-Mail ist möglicherweise bereits vergeben.");
      setLoading(false);
      return;
    }

    // If "Confirm email" is off, user is immediately logged in
    if (data.user && data.session) {
      await fetch("/api/auth/ensure-user", { method: "POST" });
      router.push("/dashboard");
      return;
    }

    // If "Confirm email" is on, show confirmation message
    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-8">
            <h2 className="text-xl font-bold text-white mb-2">Bestätige deine E-Mail</h2>
            <p className="text-zinc-400">
              Wir haben eine Bestätigungs-E-Mail an <span className="text-white">{email}</span> gesendet.
              Klicke auf den Link in der E-Mail, um dein Konto zu aktivieren.
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
          <h1 className="text-3xl font-bold text-white">Vendora</h1>
          <p className="text-zinc-400 mt-2">Erstelle dein Konto</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
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

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Mindestens 8 Zeichen"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              placeholder="Passwort wiederholen"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
          >
            {loading ? "Wird erstellt..." : "Konto erstellen"}
          </button>
        </form>

        <p className="mt-6 text-center text-zinc-500 text-sm">
          Bereits ein Konto?{" "}
          <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
