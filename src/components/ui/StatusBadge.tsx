"use client";

import { useLanguage } from "@/lib/context/LanguageContext";
import { toneClasses, type Tone } from "@/lib/statusColors";

const statusTones: Record<string, Tone> = {
  open: "orange",
  paid: "green",
  shipped: "blue",
  delivered: "green",
  cancelled: "red",
};

export const ORDER_STATUS_LABELS: Record<string, { en: string; de: string }> = {
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
  const colors = toneClasses(statusTones[status] ?? "neutral");
  const label = ORDER_STATUS_LABELS[status]?.[language] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {label}
    </span>
  );
}
