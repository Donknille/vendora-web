"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, ChevronRight, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatDate } from "@/lib/formatCurrency";

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string;
  plan: "free" | "trial" | "pro";
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  trialEndsAt: string | null;
  isBlocked: boolean;
  lastSeenAt: string | null;
  counts: { orders: number; markets: number; expenses: number };
};

type Result = { users: AdminUserRow[]; total: number; page: number; pageSize: number };

const planColors: Record<string, string> = {
  free: "text-secondary",
  trial: "text-brand-primary",
  pro: "text-green-600",
};

const PAGE_SIZE = 25;

export function AdminUserTable() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [blocked, setBlocked] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (blocked) params.set("blocked", blocked);

      setLoading(true);
      fetch(`/api/admin/users?${params}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: Result) => {
          setData(d);
          setLoading(false);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setLoading(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, status, blocked, page]);

  // Changing a filter invalidates the page number. Done in the handlers rather
  // than in an effect, so the list is fetched once instead of twice.
  const applyFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-primary">
          Nutzer{data ? ` (${data.total})` : ""}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => applyFilter(setSearch)(e.target.value)}
              placeholder="E-Mail suchen…"
              className="bg-page border border-line rounded-lg pl-8 pr-3 py-1.5 text-sm text-primary placeholder-holder focus:outline-none focus:border-brand-primary"
            />
          </div>

          <select
            value={status}
            onChange={(e) => applyFilter(setStatus)(e.target.value)}
            className="bg-page border border-line rounded-lg px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-brand-primary"
          >
            <option value="">Alle Status</option>
            <option value="trial">Trial</option>
            <option value="active">Aktiv</option>
            <option value="expired">Abgelaufen</option>
            <option value="cancelled">Gekündigt</option>
          </select>

          <select
            value={blocked}
            onChange={(e) => applyFilter(setBlocked)(e.target.value)}
            className="bg-page border border-line rounded-lg px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-brand-primary"
          >
            <option value="">Alle</option>
            <option value="true">Nur gesperrte</option>
            <option value="false">Nur aktive</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="pb-2 text-left font-medium text-muted">E-Mail</th>
              <th className="pb-2 text-left font-medium text-muted">Plan</th>
              <th className="pb-2 text-center font-medium text-muted">Aufträge</th>
              <th className="pb-2 text-center font-medium text-muted">Märkte</th>
              <th className="pb-2 text-right font-medium text-muted">Zuletzt aktiv</th>
              <th className="pb-2 text-right font-medium text-muted">Registriert</th>
              <th className="pb-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user) => (
              <tr key={user.id} className="border-b border-line-subtle">
                <td className="py-3 text-primary">
                  <div className="flex items-center gap-2">
                    {user.isBlocked && <Ban className="h-3.5 w-3.5 text-red-500" />}
                    <span className={user.isBlocked ? "line-through text-muted" : ""}>
                      {user.email}
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`font-medium capitalize ${planColors[user.plan] ?? "text-muted"}`}>
                    {user.plan}
                  </span>
                </td>
                <td className="py-3 text-center text-secondary">{user.counts.orders}</td>
                <td className="py-3 text-center text-secondary">{user.counts.markets}</td>
                <td className="py-3 text-right text-faint">
                  {user.lastSeenAt ? formatDate(user.lastSeenAt, "de-DE") : "nie"}
                </td>
                <td className="py-3 text-right text-faint">
                  {formatDate(user.createdAt, "de-DE")}
                </td>
                <td className="py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-faint hover:text-primary transition-colors inline-block"
                    aria-label={`${user.email} verwalten`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && <p className="text-sm text-muted py-4 text-center">Laden…</p>}
        {!loading && data?.users.length === 0 && (
          <p className="text-sm text-muted py-6 text-center">Kein Nutzer passt zu diesem Filter.</p>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-line text-primary disabled:opacity-40"
          >
            Zurück
          </button>
          <span className="text-muted">
            Seite {data.page} von {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg border border-line text-primary disabled:opacity-40"
          >
            Weiter
          </button>
        </div>
      )}
    </Card>
  );
}
