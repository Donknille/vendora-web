"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Shield, Users, CreditCard, Clock, Ban, Activity, TrendingUp, Lock, ScrollText,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/formatCurrency";
import { AdminUserTable } from "./_components/AdminUserTable";

// recharts needs the DOM; keep it off the server render.
const SignupChart = dynamic(() => import("./_components/SignupChart"), {
  ssr: false,
  loading: () => <p className="text-sm text-muted py-8 text-center">Chart lädt…</p>,
});

type Stats = {
  overview: {
    totalUsers: number; activeSubscriptions: number; trialUsers: number;
    expiredUsers: number; cancelledUsers: number; blockedUsers: number; deletedUsers: number;
  };
  growth: { month: string; signups: number; cumulative: number }[];
  conversion: { trialRunning: number; converted: number; lapsed: number; conversionRate: number | null };
  activity: { activeLast7Days: number; activeLast30Days: number; neverSignedIn: number };
  adoption: {
    totalUsers: number; withOrders: number; withInvoices: number; withMarkets: number;
    withMarketSales: number; withExpenses: number; withEuerExport: number; emptyAccounts: number;
  };
  revenue: { payingAccounts: number; monthlyRecurringCents: number; pricePerAccountCents: number };
};

function Metric({ icon, value, label, tone = "text-primary" }: {
  icon: React.ReactNode; value: string | number; label: string; tone?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className={`text-2xl font-bold ${tone}`}>{value}</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function AdoptionBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-secondary">{label}</span>
        <span className="text-muted">{value} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-page overflow-hidden">
        <div className="h-full bg-brand-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((s) => { setStats(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted">Laden…</p></div>;
  }

  if (!stats?.overview) {
    return <div className="py-20 text-center"><p className="text-muted">Statistiken konnten nicht geladen werden.</p></div>;
  }

  const { overview, growth, conversion, activity, adoption, revenue } = stats;
  const rate = conversion.conversionRate;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-brand-primary" />
          <h1 className="text-2xl font-bold text-primary">Plattform-Administration</h1>
        </div>
        <Link
          href="/admin/audit"
          className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
        >
          <ScrollText className="h-4 w-4" />
          Audit-Log
        </Link>
      </div>

      {/* The separation the operator asked for, stated where it is relied on. */}
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface/60 p-3">
        <Lock className="h-4 w-4 text-brand-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          Diese Ansicht zeigt ausschließlich Konten-Metadaten und plattformweite Summen.
          Umsätze, Belege, Rechnungen und Ausgaben einzelner Nutzer sind hier technisch
          nicht abrufbar — der Admin-Bereich hat keinen Zugriff auf diese Daten.
        </p>
      </div>

      {/* Konten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={<Users className="h-5 w-5 text-brand-primary" />} value={overview.totalUsers} label="Konten" />
        <Metric icon={<CreditCard className="h-5 w-5 text-green-600" />} value={overview.activeSubscriptions} label="Zahlende Abos" />
        <Metric icon={<Clock className="h-5 w-5 text-yellow-500" />} value={overview.trialUsers} label="In Testphase" />
        <Metric icon={<Ban className="h-5 w-5 text-red-500" />} value={overview.blockedUsers} label="Gesperrt" />
      </div>

      {/* Eigener Umsatz */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">Deine Abo-Einnahmen</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(revenue.monthlyRecurringCents)}
            </p>
            <p className="text-xs text-muted">wiederkehrend pro Monat</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{revenue.payingAccounts}</p>
            <p className="text-xs text-muted">zahlende Konten</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(revenue.pricePerAccountCents)}
            </p>
            <p className="text-xs text-muted">Listenpreis je Konto</p>
          </div>
        </div>
        <p className="text-xs text-faint mt-3">
          Hochgerechnet aus zahlenden Konten × Listenpreis. Maßgeblich abgerechnet wird über Stripe.
        </p>
      </Card>

      {/* Wachstum */}
      <Card>
        <h2 className="text-base font-semibold text-primary mb-3">Registrierungen je Monat</h2>
        <SignupChart data={growth} />
      </Card>

      {/* Konversion + Aktivität */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-base font-semibold text-primary mb-3">Testphase → Pro</h2>
          <p className="text-3xl font-bold text-primary">
            {rate === null ? "—" : `${Math.round(rate * 100)} %`}
          </p>
          <p className="text-xs text-muted mb-3">
            {rate === null
              ? "Noch keine Testphase abgelaufen."
              : "gemessen an abgelaufenen Testphasen"}
          </p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-secondary">läuft noch</dt><dd className="text-primary">{conversion.trialRunning}</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">konvertiert</dt><dd className="text-green-600">{conversion.converted}</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">abgesprungen</dt><dd className="text-muted">{conversion.lapsed}</dd></div>
          </dl>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-brand-primary" />
            <h2 className="text-base font-semibold text-primary">Aktivität</h2>
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-secondary">aktiv (7 Tage)</dt><dd className="text-primary">{activity.activeLast7Days}</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">aktiv (30 Tage)</dt><dd className="text-primary">{activity.activeLast30Days}</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">nie angemeldet</dt><dd className="text-muted">{activity.neverSignedIn}</dd></div>
            <div className="flex justify-between"><dt className="text-secondary">leere Konten</dt><dd className="text-muted">{adoption.emptyAccounts}</dd></div>
          </dl>
          <p className="text-xs text-faint mt-3">Basiert auf Anmeldungen, nicht auf Inhalten.</p>
        </Card>
      </div>

      {/* Feature-Nutzung */}
      <Card>
        <h2 className="text-base font-semibold text-primary mb-1">Welche Funktionen genutzt werden</h2>
        <p className="text-xs text-muted mb-4">
          Anteil der Konten, die eine Funktion mindestens einmal verwendet haben.
        </p>
        <div className="space-y-3">
          <AdoptionBar label="Aufträge" value={adoption.withOrders} total={adoption.totalUsers} />
          <AdoptionBar label="Rechnungen" value={adoption.withInvoices} total={adoption.totalUsers} />
          <AdoptionBar label="Märkte" value={adoption.withMarkets} total={adoption.totalUsers} />
          <AdoptionBar label="Marktverkäufe (Kasse)" value={adoption.withMarketSales} total={adoption.totalUsers} />
          <AdoptionBar label="Ausgaben" value={adoption.withExpenses} total={adoption.totalUsers} />
          <AdoptionBar label="EÜR-Export" value={adoption.withEuerExport} total={adoption.totalUsers} />
        </div>
      </Card>

      <AdminUserTable />
    </div>
  );
}
