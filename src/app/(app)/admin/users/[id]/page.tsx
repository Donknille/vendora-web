"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Calendar, ShoppingCart, Store, Receipt, Clock,
  Ban, CheckCircle, Plus, Trash2, LogIn,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "@/lib/formatCurrency";
import type { AdminUserRow } from "../../_components/AdminUserTable";

const planLabels: Record<string, string> = { free: "Free", trial: "Testphase", pro: "Pro" };
const planColors: Record<string, string> = {
  free: "text-secondary",
  trial: "text-brand-primary",
  pro: "text-green-600",
};

type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean> | null;
};

const actionLabels: Record<string, string> = {
  grant_pro: "Pro gewährt",
  revoke_pro: "Pro entzogen",
  extend_trial: "Testphase verlängert",
  block: "gesperrt",
  unblock: "entsperrt",
  delete_user: "Konto gelöscht",
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | "block" | "delete">(null);
  const [grantDays, setGrantDays] = useState(30);
  const [trialDays, setTrialDays] = useState(14);

  const load = useCallback(async () => {
    try {
      const [u, a] = await Promise.all([
        fetch(`/api/admin/users/${id}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/admin/audit?targetUserId=${id}&pageSize=20`).then((r) =>
          r.ok ? r.json() : { entries: [] }
        ),
      ]);
      setUser(u);
      setHistory(a.entries ?? []);
    } catch {
      setError("Daten konnten nicht geladen werden.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // Legitimate effect use: loads the account from the API on mount; the state
    // comes from the response, not from props during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? "Aktion fehlgeschlagen.");
      } else if (body.action === "delete_user") {
        router.push("/admin");
        return;
      } else {
        await load();
      }
    } catch {
      setError("Aktion fehlgeschlagen.");
    }
    setBusy(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted">Laden…</p></div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center space-y-4">
        <p className="text-muted">Konto nicht gefunden.</p>
        <Link href="/admin" className="text-brand-primary text-sm">Zurück zur Übersicht</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Übersicht
      </Link>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-500 text-sm">
          {error}
        </div>
      )}

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-primary font-medium break-all">
              <Mail className="h-4 w-4 shrink-0 text-muted" />
              {user.email}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                seit {formatDate(user.createdAt, "de-DE")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                {user.lastSeenAt ? `zuletzt ${formatDate(user.lastSeenAt, "de-DE")}` : "nie angemeldet"}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`font-semibold ${planColors[user.plan]}`}>{planLabels[user.plan]}</p>
            {user.isBlocked && <p className="text-xs text-red-500 mt-1">gesperrt</p>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-muted" /><span className="text-sm text-muted">Aufträge</span></div>
          <p className="text-xl font-bold text-primary mt-1">{user.counts.orders}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><Store className="h-4 w-4 text-muted" /><span className="text-sm text-muted">Märkte</span></div>
          <p className="text-xl font-bold text-primary mt-1">{user.counts.markets}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted" /><span className="text-sm text-muted">Ausgaben</span></div>
          <p className="text-xl font-bold text-primary mt-1">{user.counts.expenses}</p>
        </Card>
      </div>
      <p className="text-xs text-faint -mt-3">
        Nur Anzahlen. Inhalte und Beträge dieser Datensätze sind für die Administration nicht einsehbar.
      </p>

      {/* Abo & Testphase */}
      <Card>
        <h2 className="text-base font-semibold text-primary mb-4">Zugang</h2>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="grantDays" className="text-sm text-secondary mr-auto">Pro gewähren</label>
            <input
              id="grantDays"
              type="number" min={1} max={3650} value={grantDays}
              onChange={(e) => setGrantDays(Number(e.target.value))}
              className="w-20 bg-page border border-line rounded-lg px-2 py-1.5 text-sm text-primary"
            />
            <span className="text-sm text-muted">Tage</span>
            <button
              onClick={() => act({ action: "grant_pro", days: grantDays })}
              disabled={busy}
              className="inline-flex items-center gap-1.5 bg-brand-primary text-white text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Gewähren
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="trialDays" className="text-sm text-secondary mr-auto">Testphase verlängern</label>
            <input
              id="trialDays"
              type="number" min={1} max={365} value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="w-20 bg-page border border-line rounded-lg px-2 py-1.5 text-sm text-primary"
            />
            <span className="text-sm text-muted">Tage</span>
            <button
              onClick={() => act({ action: "extend_trial", days: trialDays })}
              disabled={busy}
              className="inline-flex items-center gap-1.5 border border-line text-primary text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <Clock className="h-3.5 w-3.5" /> Verlängern
            </button>
          </div>

          {user.plan === "pro" && (
            <button
              onClick={() => act({ action: "revoke_pro" })}
              disabled={busy}
              className="text-sm text-muted hover:text-primary transition-colors"
            >
              Pro entziehen
            </button>
          )}
        </div>
      </Card>

      {/* Sperren / Löschen */}
      <Card>
        <h2 className="text-base font-semibold text-primary mb-4">Konto</h2>
        <div className="flex flex-wrap gap-2">
          {user.isBlocked ? (
            <button
              onClick={() => act({ action: "unblock" })}
              disabled={busy}
              className="inline-flex items-center gap-1.5 border border-line text-primary text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Entsperren
            </button>
          ) : (
            <button
              onClick={() => setConfirm("block")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 border border-line text-primary text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" /> Sperren
            </button>
          )}

          <button
            onClick={() => setConfirm("delete")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 border border-red-500/40 text-red-500 text-sm px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Konto löschen
          </button>
        </div>
      </Card>

      {/* Verlauf */}
      <Card>
        <h2 className="text-base font-semibold text-primary mb-3">Verlauf</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Keine administrativen Eingriffe auf diesem Konto.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-line-subtle pb-2 last:border-0">
                <span className="text-primary">
                  {actionLabels[e.action] ?? e.action}
                  {e.metadata?.days ? ` (${e.metadata.days} Tage)` : ""}
                </span>
                <span className="text-faint">
                  {formatDate(e.createdAt, "de-DE")} · {e.actorEmail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={confirm === "block"}
        title="Konto sperren?"
        message={`${user.email} kann sich danach nicht mehr anmelden. Die Daten bleiben erhalten und die Sperre lässt sich jederzeit aufheben.`}
        confirmText="Sperren"
        onConfirm={() => act({ action: "block" })}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        title="Konto endgültig löschen?"
        message={`Alle Daten von ${user.email} werden gelöscht — Aufträge, Märkte, Verkäufe, Ausgaben und das Firmenprofil. Ausgestellte Rechnungen werden nicht gelöscht, sondern gesetzlich vorgeschrieben archiviert. Der Vorgang ist nicht umkehrbar.`}
        confirmText="Endgültig löschen"
        onConfirm={() => act({ action: "delete_user", confirmEmail: user.email })}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
