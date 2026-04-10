"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Mail, Calendar, ShoppingCart, Store, Receipt, Clock, Ban, CheckCircle, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface UserDetail {
  id: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  isBlocked: boolean;
  subscription: {
    status: string;
    isActive: boolean;
    daysRemaining: number | null;
  };
}

interface UserStats {
  orders: number;
  markets: number;
  expenses: number;
}

const statusLabels: Record<string, string> = {
  trial: "Testphase",
  active: "Aktives Abo",
  expired: "Abgelaufen",
  cancelled: "Gekündigt",
};

const statusColors: Record<string, string> = {
  trial: "text-yellow-500",
  active: "text-brand-tealDark",
  expired: "text-brand-primary",
  cancelled: "text-brand-primary",
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);

  const fetchUser = async () => {
    try {
      const [userData, usersData] = await Promise.all([
        fetch(`/api/admin/users/${id}`).then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
      ]);
      setUser(userData);
      const found = Array.isArray(usersData) ? usersData.find((u: { id: string }) => u.id === id) : null;
      setStats(found?.stats ?? null);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => { fetchUser(); }, [id]);

  const handleAction = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await fetchUser();
    } catch {
      // ignore
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">Laden...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">User nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-display text-primary">{user.email}</h1>
          <p className="text-sm text-muted flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> User-Verwaltung
          </p>
        </div>
      </div>

      {/* Account Info */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Account</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted" />
            <span className="text-primary">{user.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-muted" />
            <span className="text-secondary">
              Registriert: {new Date(user.createdAt).toLocaleDateString("de-DE")}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <CreditCardIcon status={user.subscriptionStatus} />
            <span className={statusColors[user.subscriptionStatus] || "text-muted"}>
              {statusLabels[user.subscriptionStatus] || user.subscriptionStatus}
              {user.subscription.daysRemaining !== null && user.subscription.daysRemaining > 0 && (
                <span className="text-faint ml-1">
                  (noch {user.subscription.daysRemaining} Tage)
                </span>
              )}
            </span>
          </div>
          {user.isBlocked && (
            <div className="flex items-center gap-3 text-sm">
              <Ban className="h-4 w-4 text-brand-primary" />
              <span className="text-brand-primary font-medium">Gesperrt</span>
            </div>
          )}
        </div>
      </Card>

      {/* Activity Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-muted" />
              <span className="text-xs text-muted">Aufträge</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.orders}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-4 w-4 text-muted" />
              <span className="text-xs text-muted">Märkte</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.markets}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-muted" />
              <span className="text-xs text-muted">Ausgaben</span>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.expenses}</p>
          </Card>
        </div>
      )}

      {/* Actions */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Aktionen</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleAction({ action: "extend_trial", days: 14 })}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-secondary hover:bg-elevated disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Trial +14 Tage
          </button>

          <button
            onClick={() => {
              const date = new Date();
              date.setFullYear(date.getFullYear() + 1);
              handleAction({ action: "activate_subscription", expiresAt: date.toISOString() });
            }}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-teal/90 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-4 w-4" />
            Abo aktivieren (1 Jahr)
          </button>

          {user.isBlocked ? (
            <button
              onClick={() => handleAction({ action: "unblock" })}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-teal/20 bg-brand-teal/5 px-4 py-2.5 text-sm font-medium text-brand-teal hover:bg-brand-teal/10 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Entsperren
            </button>
          ) : (
            <button
              onClick={() => setShowBlockDialog(true)}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
            >
              <Ban className="h-4 w-4" />
              Sperren
            </button>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={showBlockDialog}
        onClose={() => setShowBlockDialog(false)}
        onConfirm={() => handleAction({ action: "block" })}
        title="User sperren"
        message={`${user.email} wird gesperrt. Der User kann sich weiterhin einloggen, aber keine Aktionen mehr durchführen.`}
        confirmText="Sperren"
        cancelText="Abbrechen"
      />
    </div>
  );
}

function CreditCardIcon({ status }: { status: string }) {
  if (status === "trial") return <Clock className="h-4 w-4 text-yellow-500" />;
  if (status === "active") return <CheckCircle className="h-4 w-4 text-brand-tealDark" />;
  return <Ban className="h-4 w-4 text-brand-primary" />;
}
