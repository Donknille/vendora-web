"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

const releases = [
  {
    version: "1.0.0",
    date: "2026-04-10",
    title: "Erster Release",
    changes: [
      "Dashboard mit Umsatz, Ausgaben und Nettogewinn",
      "Auftragsverwaltung mit Status-Tracking (offen, bezahlt, versendet, geliefert)",
      "Automatische Rechnungserstellung mit PDF-Export",
      "Marktveranstaltungs-Tracking mit Standgebühren, Fahrtkosten und Gewinnberechnung",
      "Ausgabenerfassung in 7 Kategorien",
      "Firmenprofil-Verwaltung für Rechnungen",
      "Backup & Restore als JSON",
      "Zweisprachig: Deutsch und Englisch",
      "Light/Dark Mode mit System-Erkennung",
      "Supabase Auth (E-Mail/Passwort)",
      "Security: Content Security Policy, Input-Validierung, XSS-Schutz",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-primary">Changelog</h1>
      </div>

      {releases.map((release) => (
        <Card key={release.version}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-primary">
              v{release.version} — {release.title}
            </h2>
            <span className="text-sm text-muted">{release.date}</span>
          </div>
          <ul className="space-y-1.5">
            {release.changes.map((change, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                <span className="text-emerald-500 mt-0.5">+</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
