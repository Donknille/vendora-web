"use client";

import { useLanguage } from "@/lib/context/LanguageContext";

const statusColors: Record<string, string> = {
  open: "bg-orange-100 text-orange-800 border-orange-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  shipped: "bg-blue-100 text-blue-800 border-blue-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
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
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {label}
    </span>
  );
}
