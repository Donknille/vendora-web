"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passw\u00F6rter stimmen nicht \u00FCberein");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Passwort konnte nicht ge\u00E4ndert werden. Bitte versuche es erneut.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Neues Passwort</h1>
          <p className="text-zinc-400 mt-2">W\u00E4hle ein neues Passwort f\u00FCr dein Konto.</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Neues Passwort</label>
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
            <label className="block text-sm text-zinc-400 mb-1">Passwort best\u00E4tigen</label>
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
            {loading ? "Wird gespeichert..." : "Passwort \u00E4ndern"}
          </button>
        </form>
      </div>
    </div>
  );
}
