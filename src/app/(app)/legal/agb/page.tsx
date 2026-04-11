"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function AGBPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg p-2 text-faint hover:text-primary hover:bg-elevated transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-primary">Allgemeine Geschäftsbedingungen</h1>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 1 Geltungsbereich</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für die Nutzung der Web-Anwendung „Vendora"
          (nachfolgend „Dienst"), betrieben von Sebastian Grüber, DigitalFlowSolutions,
          Falkenweg 6, 38820 Halberstadt (nachfolgend „Anbieter"). Mit der Registrierung
          akzeptiert der Nutzer diese AGB.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 2 Leistungsbeschreibung</h2>
        <p className="text-sm text-secondary leading-relaxed mb-2">
          Vendora ist ein webbasiertes Business-Management-Tool für Kleinunternehmer. Der Dienst umfasst:
        </p>
        <ul className="space-y-1 text-sm text-secondary list-disc list-inside">
          <li>Verwaltung von Aufträgen und Rechnungen</li>
          <li>Erfassung von Marktveranstaltungen und Verkäufen</li>
          <li>Ausgabenverwaltung mit Kategorisierung</li>
          <li>Finanzübersicht und Berichtswesen</li>
          <li>Datenexport und -import</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 3 Registrierung und Konto</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>(1) Für die Nutzung ist eine Registrierung mit gültiger E-Mail-Adresse und Passwort erforderlich.</p>
          <p>(2) Der Nutzer ist für die Geheimhaltung seiner Zugangsdaten verantwortlich.</p>
          <p>(3) Der Nutzer gewährleistet, dass seine Angaben bei der Registrierung wahrheitsgemäß und vollständig sind.</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 4 Kostenlose Testphase und Abonnement</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>(1) Nach der Registrierung erhält der Nutzer eine kostenlose Testphase von 6 Wochen mit vollem Funktionsumfang.</p>
          <p>(2) Nach Ablauf der Testphase ist ein kostenpflichtiges Abonnement (2,99 €/Monat) erforderlich, um neue Aufträge, Märkte und Ausgaben zu erstellen.</p>
          <p>(3) Bestehende Daten bleiben auch ohne aktives Abonnement einsehbar. Bereits erstellte Rechnungen können weiterhin generiert werden.</p>
          <p>(4) Das Abonnement verlängert sich automatisch um jeweils einen Monat, sofern es nicht vor Ablauf gekündigt wird.</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 5 Kündigung</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>(1) Das Abonnement kann jederzeit zum Ende des laufenden Abrechnungszeitraums gekündigt werden.</p>
          <p>(2) Der Nutzer kann sein Konto jederzeit über die Einstellungen löschen. Dabei werden alle Daten unwiderruflich gelöscht.</p>
          <p>(3) Der Anbieter behält sich das Recht vor, Konten bei Verstoß gegen diese AGB zu sperren oder zu löschen.</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 6 Datenschutz</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Die Erhebung und Verarbeitung personenbezogener Daten erfolgt gemäß der{" "}
          <Link href="/legal/datenschutz" className="text-brand-primary hover:text-brand-primary/80">
            Datenschutzerklärung
          </Link>
          . Der Anbieter setzt keine Tracking- oder Analyse-Tools ein.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 7 Verfügbarkeit</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>(1) Der Anbieter bemüht sich um eine möglichst unterbrechungsfreie Verfügbarkeit des Dienstes, übernimmt jedoch keine Garantie für eine bestimmte Verfügbarkeit.</p>
          <p>(2) Wartungsarbeiten werden nach Möglichkeit vorab angekündigt.</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 8 Haftung</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>(1) Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit.</p>
          <p>(2) Für leichte Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>
          <p>(3) Der Dienst ersetzt keine professionelle Buchhaltungs- oder Steuerberatung. Der Nutzer ist für die Richtigkeit seiner eingegebenen Daten und die Einhaltung steuerlicher Pflichten selbst verantwortlich.</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 9 Änderungen der AGB</h2>
        <p className="text-sm text-secondary leading-relaxed">
          Der Anbieter behält sich vor, diese AGB mit angemessener Ankündigungsfrist zu ändern.
          Der Nutzer wird über Änderungen per E-Mail informiert. Bei Widerspruch innerhalb von 4 Wochen
          nach Zugang der Änderungsmitteilung steht dem Nutzer ein Sonderkündigungsrecht zu.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 10 Schlussbestimmungen</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>(1) Es gilt das Recht der Bundesrepublik Deutschland.</p>
          <p>(2) Sollten einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
        </div>
        <p className="text-sm text-muted mt-4">Stand: April 2026</p>
      </Card>
    </div>
  );
}
