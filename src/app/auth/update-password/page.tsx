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
      setError("Passwörter stimmen nicht überein");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("Passwort konnte nicht geändert werden. Bitte versuche es erneut.");
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
          <h1 className="text-3xl font-bold text-primary font-display">Neues Passwort</h1>
          <p className="text-faint mt-2">Wähle ein neues Passwort für dein Konto.</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-faint mb-1">Neues Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-teal transition"
              placeholder="Mindestens 8 Zeichen"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-faint mb-1">Passwort bestätigen</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-surface border border-line rounded-lg px-4 py-3 text-primary placeholder-holder focus:outline-none focus:border-brand-teal transition"
              placeholder="Passwort wiederholen"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 text-primary font-medium py-3 rounded-lg transition"
          >
            {loading ? "Wird gespeichert..." : "Passwort ändern"}
          </button>
        </form>
      </div>
    </div>
  );
}
