"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Users, CreditCard, Clock, Ban, ShoppingCart, Store, Receipt, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { formatDate } from "@/lib/formatCurrency";
import { Card } from "@/components/ui/Card";

interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  expiredUsers: number;
  blockedUsers: number;
  totalOrders: number;
  totalMarkets: number;
  totalExpenses: number;
}

interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscriptionExpiresAt: string | null;
  isBlocked: boolean;
  stats: { orders: number; markets: number; expenses: number };
}

const statusColors: Record<string, string> = {
  trial: "text-yellow-500",
  active: "text-brand-tealDark",
  expired: "text-brand-primary",
  cancelled: "text-brand-primary",
};

export default function AdminDashboardPage() {
  const { language } = useLanguage();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]).then(([s, u]) => {
      setStats(s);
      setUsers(Array.isArray(u) ? u : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted">Laden...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-brand-teal" />
        <h1 className="text-2xl font-bold font-display text-primary">Admin Dashboard</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-brand-teal" />
              <div>
                <p className="text-2xl font-bold text-primary">{stats.totalUsers}</p>
                <p className="text-xs text-muted">User gesamt</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-brand-teal" />
              <div>
                <p className="text-2xl font-bold text-primary">{stats.activeSubscriptions}</p>
                <p className="text-xs text-muted">Aktive Abos</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-primary">{stats.trialUsers}</p>
                <p className="text-xs text-muted">Trial</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Ban className="h-5 w-5 text-brand-primary" />
              <div>
                <p className="text-2xl font-bold text-primary">{stats.expiredUsers}</p>
                <p className="text-xs text-muted">Abgelaufen</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Platform Activity */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">Aufträge</span>
            </div>
            <p className="text-xl font-bold text-primary mt-1">{stats.totalOrders}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">Märkte</span>
            </div>
            <p className="text-xl font-bold text-primary mt-1">{stats.totalMarkets}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted" />
              <span className="text-sm text-muted">Ausgaben</span>
            </div>
            <p className="text-xl font-bold text-primary mt-1">{stats.totalExpenses}</p>
          </Card>
        </div>
      )}

      {/* User List */}
      <Card>
        <h2 className="text-base font-semibold text-primary mb-4">
          Alle User ({users.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="pb-2 text-left font-medium text-muted">E-Mail</th>
                <th className="pb-2 text-left font-medium text-muted">Status</th>
                <th className="pb-2 text-center font-medium text-muted">Aufträge</th>
                <th className="pb-2 text-center font-medium text-muted">Märkte</th>
                <th className="pb-2 text-right font-medium text-muted">Registriert</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-line-subtle">
                  <td className="py-3 text-primary">
                    <div className="flex items-center gap-2">
                      {user.isBlocked && <Ban className="h-3.5 w-3.5 text-brand-primary" />}
                      <span className={user.isBlocked ? "line-through text-muted" : ""}>
                        {user.email}
                      </span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={`font-medium capitalize ${statusColors[user.subscriptionStatus] || "text-muted"}`}>
                      {user.subscriptionStatus}
                    </span>
                  </td>
                  <td className="py-3 text-center text-secondary">{user.stats.orders}</td>
                  <td className="py-3 text-center text-secondary">{user.stats.markets}</td>
                  <td className="py-3 text-right text-faint">
                    {formatDate(user.createdAt, language === "de" ? "de-DE" : "en-US")}
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-faint hover:text-primary transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
