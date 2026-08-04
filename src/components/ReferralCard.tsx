"use client";

import { ExternalLink } from "lucide-react";

// Generic, env-configurable referral placement (Phase 4.4). Renders nothing when
// no URL is configured, so a slot is only shown once an affiliate link exists.
// Always marked "Anzeige"/"Ad" (UWG) and uses rel="sponsored". No user data is
// ever sent to the partner.
export function ReferralCard({
  url,
  title,
  description,
  cta,
  de,
}: {
  url: string | undefined;
  title: string;
  description: string;
  cta: string;
  de: boolean;
}) {
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className="block rounded-xl border border-line bg-elevated p-4 hover:border-brand-primary transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {de ? "Anzeige" : "Ad"}
        </span>
      </div>
      <p className="mt-1 text-xs text-faint">{description}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
        {cta}
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
}
