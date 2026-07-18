"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="javascript:void(0)" onClick={() => window.history.back()}
          className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-primary">Datenschutzerklärung</h1>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">1. Verantwortlicher</h2>
        <div className="space-y-1 text-sm text-secondary">
          <p>Sebastian Grüber</p>
          <p>DigitalFlowSolutions</p>
          <p>Falkenweg 6, 38820 Halberstadt</p>
          <p>E-Mail: info@digitalflowsolutions.de</p>
          <p>Telefon: 0173-5437573</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">2. Übersicht der Verarbeitungen</h2>
        <p className="text-sm text-secondary mb-3">
          Vendora verarbeitet personenbezogene Daten ausschließlich zur Bereitstellung des Dienstes.
          Es findet <strong className="text-primary">kein Tracking, keine Werbung und keine Weitergabe an Dritte</strong> zu Marketingzwecken statt.
        </p>
        <h3 className="text-sm font-medium text-primary mb-2">Verarbeitete Datenarten:</h3>
        <ul className="space-y-1 text-sm text-secondary list-disc list-inside">
          <li>E-Mail-Adresse (für Registrierung und Login)</li>
          <li>Passwort (verschlüsselt gespeichert, nie im Klartext)</li>
          <li>Firmenprofil (Name, Adresse, Telefon, Steuerhinweis)</li>
          <li>Geschäftsdaten (Aufträge, Rechnungen, Marktveranstaltungen, Ausgaben)</li>
          <li>Zahlungsdaten (nur bei kostenpflichtigem Abo — Verarbeitung ausschließlich durch Stripe, Kartendaten werden nie auf unseren Servern gespeichert)</li>
          <li>Nutzungseinstellungen (Theme, Sprache) — ausschließlich lokal im Browser gespeichert</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">3. Rechtsgrundlagen</h2>
        <ul className="space-y-2 text-sm text-secondary">
          <li><strong className="text-primary">Art. 6 Abs. 1 lit. b DSGVO</strong> — Verarbeitung zur Vertragserfüllung (Bereitstellung des SaaS-Dienstes)</li>
          <li><strong className="text-primary">Art. 6 Abs. 1 lit. a DSGVO</strong> — Einwilligung (bei optionalen Funktionen wie E-Mail-Bestätigung)</li>
          <li><strong className="text-primary">Art. 6 Abs. 1 lit. f DSGVO</strong> — Berechtigtes Interesse (technischer Betrieb, Sicherheit)</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">4. Externe Dienste</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-primary mb-1">Neon (Datenbank-Hosting)</h3>
            <p className="text-sm text-secondary">
              Anbieter: Neon, Inc., USA. Neon betreibt die PostgreSQL-Datenbank, in der alle Nutzer- und
              Geschäftsdaten (E-Mail, Passwort-Hash, Aufträge, Rechnungen, Marktdaten, Ausgaben) gespeichert werden.
              Serverstandort: EU (Frankfurt). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary mb-1">Authentifizierung</h3>
            <p className="text-sm text-secondary">
              Registrierung, Login und Sessions werden durch die selbst betriebene Software „Better Auth“ verarbeitet.
              Es findet keine Weitergabe an einen externen Authentifizierungsdienst statt — sämtliche Auth-Daten liegen
              in der oben genannten Datenbank (Neon). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary mb-1">Vercel (Hosting)</h3>
            <p className="text-sm text-secondary">
              Anbieter: Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA.
              Vercel hostet die Web-Anwendung und führt serverseitige Funktionen aus.
              Zugriffslogs (IP-Adresse, Zeitstempel) werden von Vercel kurzfristig gespeichert.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary mb-1">Stripe (Zahlungsabwicklung)</h3>
            <p className="text-sm text-secondary">
              Anbieter für Nutzer im EWR: Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock,
              Dublin, Irland. Stripe wickelt Zahlungen für kostenpflichtige Abonnements ab und verarbeitet dabei
              Zahlungs- und Rechnungsdaten. Kartendaten werden ausschließlich bei Stripe verarbeitet und erreichen
              unsere Server nicht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary mb-1">Resend (E-Mail-Versand)</h3>
            <p className="text-sm text-secondary">
              Anbieter: Resend (Plus Five Five, Inc.), USA. Resend versendet transaktionale E-Mails
              (z.&nbsp;B. Passwort-Reset, E-Mail-Bestätigung) und verarbeitet dazu die E-Mail-Adresse des Empfängers.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-primary mb-1">Arcjet (Sicherheit & Rate-Limiting)</h3>
            <p className="text-sm text-secondary">
              Anbieter: Arcjet, Inc., USA. Arcjet schützt die Anwendung vor Missbrauch (Rate-Limiting, Bot-Abwehr)
              und verarbeitet dazu technische Verbindungsdaten wie die IP-Adresse. Rechtsgrundlage:
              Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Betriebssicherheit).
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">5. Datensicherheit</h2>
        <ul className="space-y-1 text-sm text-secondary list-disc list-inside">
          <li>Verschlüsselte Übertragung aller Daten via HTTPS/TLS</li>
          <li>Passwörter werden mit einem sicheren, langsamen Hash-Verfahren (scrypt) gespeichert (nie im Klartext)</li>
          <li>Zugriffskontrolle: Jeder Nutzer sieht ausschließlich seine eigenen Daten</li>
          <li>Serverseitige Prüfung von Authentifizierung und Eigentümerschaft bei jeder Datenbankabfrage</li>
          <li>Eingabevalidierung auf allen API-Endpunkten (Schutz vor Injection-Angriffen)</li>
          <li>Content Security Policy (CSP) Header zum Schutz vor Cross-Site-Scripting</li>
          <li>Kein Tracking, keine Analytics, keine Cookies zu Werbezwecken</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">6. Ihre Rechte</h2>
        <p className="text-sm text-secondary mb-3">
          Sie haben gemäß DSGVO folgende Rechte bezüglich Ihrer personenbezogenen Daten:
        </p>
        <ul className="space-y-2 text-sm text-secondary">
          <li><strong className="text-primary">Auskunft (Art. 15)</strong> — Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen. Die Export-Funktion in den Einstellungen ermöglicht den Download aller Daten als JSON.</li>
          <li><strong className="text-primary">Berichtigung (Art. 16)</strong> — Sie können Ihre Daten jederzeit in der Anwendung selbst korrigieren.</li>
          <li><strong className="text-primary">Löschung (Art. 17)</strong> — Sie können Ihr Konto und alle zugehörigen Daten jederzeit über die Einstellungen löschen.</li>
          <li><strong className="text-primary">Datenübertragbarkeit (Art. 20)</strong> — Über die Backup-Funktion können Sie alle Daten in einem maschinenlesbaren Format (JSON) exportieren.</li>
          <li><strong className="text-primary">Widerspruch (Art. 21)</strong> — Sie können der Verarbeitung Ihrer Daten jederzeit widersprechen.</li>
          <li><strong className="text-primary">Beschwerde (Art. 77)</strong> — Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">7. Speicherdauer</h2>
        <p className="text-sm text-secondary">
          Ihre Daten werden gespeichert, solange Ihr Konto aktiv ist. Nach Löschung des Kontos werden alle personenbezogenen Daten
          und Geschäftsdaten gelöscht bzw. anonymisiert.
        </p>
        <p className="text-sm text-secondary mt-2">
          <strong className="text-primary">Ausnahme — steuerrechtliche Aufbewahrung:</strong> Ausgestellte Rechnungen und die
          zugehörigen Buchungsbelege unterliegen der gesetzlichen Aufbewahrungspflicht (§ 147 AO, § 14b UStG — in der Regel
          10 Jahre). Diese Belege werden daher auch nach einer Kontolöschung für die Dauer der gesetzlichen Frist in
          entkoppelter Form aufbewahrt und anschließend gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO
          (rechtliche Verpflichtung); die Löschung ist insoweit nach Art. 17 Abs. 3 lit. b DSGVO eingeschränkt.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">8. Kontakt für Datenschutzanfragen</h2>
        <p className="text-sm text-secondary">
          Bei Fragen zum Datenschutz oder zur Ausübung Ihrer Rechte wenden Sie sich bitte an:
        </p>
        <div className="mt-2 space-y-1 text-sm text-secondary">
          <p>Sebastian Grüber</p>
          <p>E-Mail: info@digitalflowsolutions.de</p>
          <p>Telefon: 0173-5437573</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">9. Änderungen</h2>
        <p className="text-sm text-secondary">
          Diese Datenschutzerklärung kann bei Bedarf aktualisiert werden, z.B. bei Änderungen der genutzten Dienste
          oder rechtlichen Anforderungen. Die aktuelle Version ist stets unter dieser Adresse abrufbar.
        </p>
        <p className="text-sm text-muted mt-2">Stand: Juli 2026</p>
      </Card>
    </div>
  );
}
