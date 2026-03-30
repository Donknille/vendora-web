"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ShoppingCart,
  Store,
  Receipt,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" as const },
  { href: "/orders", icon: ShoppingCart, labelKey: "orders" as const },
  { href: "/markets", icon: Store, labelKey: "markets" as const },
  { href: "/expenses", icon: Receipt, labelKey: "expenses" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800">
          <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="text-lg font-semibold text-zinc-100">Vendora</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{t.tabs[item.labelKey]}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>{t.auth.logout}</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around bg-zinc-900 border-t border-zinc-800 px-2 py-1 safe-area-bottom">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "text-emerald-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{t.tabs[item.labelKey]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
