"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/formatCurrency";
import { pagerButton } from "@/lib/styles";

type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  targetUserId: string;
  targetEmail: string;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: string;
};

type Result = { entries: AuditEntry[]; total: number; page: number; pageSize: number };

const actionLabels: Record<string, string> = {
  grant_pro: "Pro gewährt",
  revoke_pro: "Pro entzogen",
  extend_trial: "Testphase verlängert",
  block: "gesperrt",
  unblock: "entsperrt",
  delete_user: "Konto gelöscht",
};

const actionColors: Record<string, string> = {
  grant_pro: "text-green-600",
  revoke_pro: "text-muted",
  extend_trial: "text-brand-primary",
  block: "text-red-500",
  unblock: "text-green-600",
  delete_user: "text-red-500",
};

const PAGE_SIZE = 50;

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Legitimate effect use: the state is set from an async fetch keyed on the
    // page, not derived from props during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/admin/audit?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d: Result) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Übersicht
      </Link>

      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-brand-primary" />
        <h1 className="text-2xl font-bold text-primary">Audit-Log</h1>
      </div>

      <p className="text-xs text-muted">
        Jeder administrative Eingriff in ein fremdes Konto wird hier festgehalten.
        Einträge bleiben erhalten, auch wenn das betroffene Konto später gelöscht wird.
      </p>

      <Card>
        {loading && <p className="text-sm text-muted py-4 text-center">Laden…</p>}

        {!loading && data?.entries.length === 0 && (
          <p className="text-sm text-muted py-6 text-center">Noch keine Eingriffe protokolliert.</p>
        )}

        {!loading && data && data.entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="pb-2 text-left font-medium text-muted">Zeitpunkt</th>
                  <th className="pb-2 text-left font-medium text-muted">Aktion</th>
                  <th className="pb-2 text-left font-medium text-muted">Betroffenes Konto</th>
                  <th className="pb-2 text-left font-medium text-muted">Ausgeführt von</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id} className="border-b border-line-subtle">
                    <td className="py-3 text-faint whitespace-nowrap">
                      {formatDate(e.createdAt, "de-DE")}
                    </td>
                    <td className={`py-3 font-medium ${actionColors[e.action] ?? "text-primary"}`}>
                      {actionLabels[e.action] ?? e.action}
                      {e.metadata?.days ? ` (${e.metadata.days} Tage)` : ""}
                    </td>
                    <td className="py-3 text-primary break-all">
                      <Link href={`/admin/users/${e.targetUserId}`} className="hover:underline">
                        {e.targetEmail}
                      </Link>
                    </td>
                    <td className="py-3 text-secondary break-all">{e.actorEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={pagerButton}
            >
              Zurück
            </button>
            <span className="text-muted">Seite {data.page} von {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={pagerButton}
            >
              Weiter
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
