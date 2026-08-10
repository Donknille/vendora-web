"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator, PlayCircle, ShoppingCart, Sparkles, Store } from "lucide-react";
import { useLanguage } from "@/lib/context/LanguageContext";
import { Card } from "@/components/ui/Card";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { InstallAppCard } from "@/components/pwa/InstallAppCard";

// Statischer Erklärtext, keine Nutzerdaten — also kein force-dynamic. Liegt in
// der (app)-Gruppe, damit Session-Gate und Navigation dieselben sind wie
// überall sonst.
export default function HelpPage() {
  const { t } = useLanguage();
  const [tourOpen, setTourOpen] = useState(false);

  const topics = [
    {
      icon: Store,
      copy: t.help.tour.markets,
      more: t.help.marketsMore,
      href: "/markets",
    },
    {
      icon: ShoppingCart,
      copy: t.help.tour.orders,
      more: t.help.ordersMore,
      href: "/orders",
    },
    {
      icon: Calculator,
      copy: t.help.tour.taxes,
      more: t.help.taxesMore,
      href: "/steuer",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-primary font-display">{t.help.title}</h1>
        <p className="mt-1 text-sm text-faint">{t.help.subtitle}</p>
      </div>

      {/* ───────── Erste Schritte ───────── */}
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-brand-primary" />
          <h2 className="text-base font-semibold text-primary">{t.help.gettingStarted}</h2>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-faint">{t.help.gettingStartedBody}</p>

        <button
          onClick={() => setTourOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90"
        >
          <PlayCircle className="h-4 w-4" />
          {t.help.restartTour}
        </button>
      </Card>

      {/* ───────── Die drei Säulen ───────── */}
      {topics.map((topic) => {
        const Icon = topic.icon;
        return (
          <Card key={topic.href}>
            <div className="mb-4 flex items-center gap-3">
              <Icon className="h-5 w-5 text-brand-primary" />
              <h2 className="text-base font-semibold text-primary">{topic.copy.title}</h2>
            </div>

            <p className="text-sm leading-relaxed text-faint">{topic.copy.body}</p>
            <p className="mt-3 text-sm leading-relaxed text-faint">{topic.more}</p>

            <Link
              href={topic.href}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary transition-colors hover:text-brand-primary/80"
            >
              {topic.copy.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        );
      })}

      {/* ───────── Als App installieren ───────── */}
      <InstallAppCard />

      {/* Hier ist das Öffnen ausdrücklich gewollt, deshalb gesteuert: der
          Merker am Konto bleibt unangetastet. */}
      <WelcomeTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
