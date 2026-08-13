"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { iconButton } from "@/lib/styles";

const releases = [
  {
    version: "1.5.0",
    date: "2026-08-10",
    title: "Bestätigte Anmeldung",
    changes: [
      "Neue Konten müssen die E-Mail-Adresse bestätigen, bevor die Anmeldung möglich ist — der Link in der Bestätigungsmail ist eine Stunde gültig",
      "Kommt keine Mail an, lässt sie sich auf der Registrierungs-, Login- und Bestätigungsseite erneut anfordern",
      "Wer sich mit unbestätigter Adresse anmeldet, liest jetzt den echten Grund statt „falsches Passwort“",
      "Bestätigungs- und Reset-Mails im Vendora-Design, mit Klartext-Fassung und Dunkelmodus",
      "E-Mail-Versand läuft jetzt über STRATO in Deutschland statt über einen US-Anbieter",
      "Beim Zurücksetzen des Passworts werden alle bestehenden Sitzungen beendet",
      "Bestehende Konten bleiben unverändert nutzbar und müssen nichts bestätigen",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-08-07",
    title: "Verlässlichkeit",
    changes: [
      "Marktmodus: ein Verkauf, den der Server ablehnt, bleibt jetzt gespeichert und wird erneut gesendet — vorher konnte er verschwinden, während die Kasse „synchronisiert“ anzeigte",
      "Die Kasse lässt sich jetzt auch ohne Empfang öffnen: Marktdaten und Schnellwahl-Artikel liegen für eine Woche auf dem Gerät",
      "Anmeldung, Registrierung und Passwort-Zurücksetzen gibt es jetzt auch auf Englisch",
      "Ein wiederhergestelltes Backup setzt die Rechnungsnummern nicht mehr zurück — vorher konnte danach keine Rechnung mehr ausgestellt werden",
      "Fehlermeldungen beim Wiederherstellen eines Backups nennen den Grund, statt nur fehlzuschlagen; dass der Import Pro voraussetzt, steht vor der Dateiauswahl",
      "Kontolöschung entfernt das Konto vollständig — die E-Mail-Adresse kann danach wieder verwendet werden",
      "Beim Abmelden werden zwischengespeicherte Seiten vom Gerät entfernt; auf einem geteilten Tablet ist nach dem Logout nichts mehr zu sehen",
      "Der Datenexport enthält jetzt auch Kundenstamm und Kontodaten (Art. 20 DSGVO)",
      "Archivierte Rechnungen werden nach Ablauf der zehnjährigen Aufbewahrungsfrist automatisch gelöscht",
      "Datenschutzerklärung und Löschdialog benennen jetzt genau, was gespeichert bleibt (Cookies, Sitzungsdaten, Rechnungsarchiv)",
      "Sicherheitsaktualisierung des Frameworks (Next.js 16.3) und mehrere Härtungen an Rate-Limiting, Abo-Verarbeitung und Exporten",
    ],
  },
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
          className={iconButton}
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
