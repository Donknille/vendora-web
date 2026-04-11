"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Ungültige E-Mail oder Passwort");
      setLoading(false);
      return;
    }

    // Ensure user record exists in our DB
    await fetch("/api/auth/ensure-user", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-[22px] font-bold text-primary">Vendora</h1>
          <p className="text-faint mt-2">Melde dich bei deinem Konto an</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-faint mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-teal transition"
              placeholder="deine@email.de"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-faint mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-teal transition"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
          >
            {loading ? "Anmelden..." : "Anmelden"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link href="/auth/reset-password" className="text-sm text-brand-primary hover:text-brand-primary/80">
            Passwort vergessen?
          </Link>
          <p className="text-muted text-sm">
            Noch kein Konto?{" "}
            <Link href="/auth/register" className="text-brand-primary hover:text-brand-primary/80">
              Registrieren
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
