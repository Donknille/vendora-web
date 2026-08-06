"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

const releases = [
  {
    version: "1.3.0",
    date: "2026-08-06",
    title: "Rechnungen & Darstellung",
    changes: [
      "Leistungsdatum lässt sich am Auftrag erfassen und erscheint auf der Rechnung (§ 14 Abs. 4 UStG)",
      "Rechnungen können nicht mehr ohne Firmenname und Anschrift ausgestellt werden — die Auftragsseite führt stattdessen zum Firmenprofil",
      "Theme und Sprache werden serverseitig gesetzt: kein Aufblitzen beim Laden mehr, die Seitensprache stimmt jetzt mit der gewählten Sprache überein",
      "Wer „Bewegung reduzieren“ aktiviert hat, bekommt auf der Startseite keine fehlerhafte Darstellung mehr",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-06",
    title: "Datenwahrheit",
    changes: [
      "Dashboard und Steuer-Übersicht rechnen jetzt mit derselben Logik — gleiche Zahlen für denselben Zeitraum",
      "Einnahmen werden überall nach dem Zuflussprinzip erfasst (Zahlungsdatum, bei Marktverkäufen der Markttag)",
      "Das Dashboard startet wie die Steuer-Übersicht im laufenden Jahr; „Alle Jahre“ bleibt einen Klick entfernt",
      "Auftragsliste zeigt den Gesamtbetrag inklusive Versandkosten — wie Detailseite, Rechnung und EÜR",
      "Standgebühren und Fahrtkosten eines Markts erscheinen jetzt in der Ausgabenliste (mit Markt-Hinweis, änderbar nur am Markt)",
      "Marktkosten werden nur noch gebucht, wenn der Markt zugesagt oder abgeschlossen ist — beworbene und abgesagte Märkte belasten die EÜR nicht mehr",
      "Ausgabenliste hat einen Jahresfilter und zeigt damit dieselbe Summe wie Dashboard und Steuer-Übersicht",
      "Der GuV-Export liegt jetzt gebündelt unter Steuer (CSV und PDF)",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-18",
    title: "Infrastruktur-Umstellung",
    changes: [
      "Umzug der Datenbank von Supabase auf Neon (PostgreSQL, EU-Region)",
      "Neue Authentifizierung mit Better Auth (E-Mail/Passwort, selbst betrieben)",
      "Transaktionale E-Mails jetzt über Resend",
      "Rate-Limiting und Bot-Schutz über Arcjet",
      "Aktualisierte Datenschutzerklärung mit den tatsächlichen Auftragsverarbeitern",
    ],
  },
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
          href="javascript:void(0)" onClick={() => window.history.back()}
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
                <span className="text-brand-primary mt-0.5">+</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
