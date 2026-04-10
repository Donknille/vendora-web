"use client";

import { useLanguage } from "@/lib/context/LanguageContext";

const statusColors: Record<string, string> = {
  open: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  paid: "bg-brand-tealLt text-brand-tealDark border-brand-teal/20",
  shipped: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  delivered: "bg-brand-tealLt text-brand-tealDark border-brand-teal/20",
  cancelled: "bg-brand-primaryLt text-brand-primary border-brand-primary/20",
};

const statusLabels: Record<string, { en: string; de: string }> = {
  open: { en: "Open", de: "Offen" },
  paid: { en: "Paid", de: "Bezahlt" },
  shipped: { en: "Shipped", de: "Versendet" },
  delivered: { en: "Delivered", de: "Geliefert" },
  cancelled: { en: "Cancelled", de: "Storniert" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { language } = useLanguage();
  const colors = statusColors[status] ?? "bg-elevated text-faint border-line";
  const label = statusLabels[status]?.[language] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {label}
    </span>
  );
}
