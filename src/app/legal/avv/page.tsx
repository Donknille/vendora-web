import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { BackLink } from "@/components/legal/BackLink";

/**
 * Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.
 *
 * WARUM ES IHN GIBT: Bilanz-Buddy speichert nicht nur die Daten der Kontoinhaber:innen,
 * sondern auch die Daten von deren Kundschaft — Name, Anschrift und E-Mail stehen
 * auf jedem Auftrag und jeder Rechnung. Für diese Daten ist die Händlerin
 * Verantwortliche und Bilanz-Buddy Auftragsverarbeiter. Art. 28 Abs. 3 DSGVO verlangt
 * dafür einen Vertrag; ohne ihn verstößt jede gewerbliche Nutzerin gegen die
 * DSGVO, und Bilanz-Buddy gleich mit.
 *
 * ZWEI DINGE, DIE VOR DEM LAUNCH STIMMEN MÜSSEN:
 *
 *  1. Das Dokument ist ein Entwurf nach dem üblichen Aufbau und ersetzt keine
 *     anwaltliche Prüfung. Vor dem ersten zahlenden Kunden prüfen lassen.
 *  2. Anlage 1 nennt die nächtliche, verschlüsselte Sicherung mit täglichem
 *     Wiederherstellungstest als technische Maßnahme. Das ist zugesagtes
 *     Verhalten — der Workflow muss also tatsächlich grün laufen
 *     (.github/workflows/backup.yml, docs/backup-runbook.md). Eine TOM, die es
 *     nur auf dem Papier gibt, ist schlimmer als keine.
 *
 * Die Fassung ist über AVV_VERSION/AVV_STAND identifizierbar: welche Fassung
 * jemand akzeptiert hat, ergibt sich bis auf Weiteres aus dem Registrierungs-
 * datum des Kontos. Ein eigenes Feld (users.avvAcceptedAt + Version) wäre der
 * sauberere Nachweis, braucht aber eine Migration.
 */

// 1.1: nur der Name des Dienstes hat gewechselt (Vendora -> Bilanz-Buddy).
// Verarbeitungszwecke, Datenkategorien und die Unterauftragnehmer sind
// unveraendert, deshalb kein erneutes Einholen der Zustimmung.
export const AVV_VERSION = "1.1";
export const AVV_STAND = "August 2026";

export const metadata: Metadata = {
  title: "Auftragsverarbeitungsvertrag — Bilanz-Buddy",
};

const DATA_CATEGORIES = [
  "Stammdaten der Kundschaft: Name, Anschrift, E-Mail-Adresse, Land",
  "Vertrags- und Auftragsdaten: Auftragspositionen, Mengen, Preise, Leistungs- und Zahlungsdatum, Status, interne Notizen",
  "Rechnungsdaten: Rechnungsnummer, Rechnungsdatum, Beträge, Steuerhinweis",
  "Marktverkaufsdaten, soweit ihnen Angaben zu einer bestimmbaren Person zugeordnet werden",
];

const DATA_SUBJECTS = [
  "Kundinnen und Kunden des Verantwortlichen",
  "Interessenten und Auftraggeber des Verantwortlichen",
  "Beschäftigte des Verantwortlichen, soweit deren Daten eingegeben werden",
];

const SUBPROCESSORS = [
  {
    name: "Neon, Inc.",
    country: "USA (Serverstandort EU, Frankfurt)",
    purpose:
      "Betrieb der PostgreSQL-Datenbank. Hier liegen sämtliche Auftrags-, Rechnungs- und Kundendaten.",
  },
  {
    name: "Vercel Inc.",
    country: "USA (Ausführung in der Region Frankfurt)",
    purpose:
      "Hosting der Anwendung und Ausführung der serverseitigen Funktionen. Verarbeitet die Daten transient während der Anfrage.",
  },
  {
    name: "Arcjet, Inc.",
    country: "USA",
    purpose:
      "Missbrauchsabwehr und Rate-Limiting. Verarbeitet Verbindungsdaten (IP-Adresse, Anfragepfad), keine Inhaltsdaten.",
  },
  {
    name: "GitHub, Inc.",
    country: "USA",
    purpose:
      "Ausführung der nächtlichen Sicherung und Aufbewahrung der Sicherungsdateien. Diese verlassen den Ablauf ausschließlich Ende-zu-Ende-verschlüsselt (age); der Schlüssel liegt nicht bei GitHub.",
  },
  {
    name: "Google Ireland Ltd. / Google LLC",
    country: "Irland / USA",
    purpose:
      "Aufbewahrung der zweiten, räumlich getrennten Kopie der Sicherung (Google Drive). Ebenfalls ausschließlich verschlüsselt.",
  },
];

const TOMS = [
  {
    title: "Vertraulichkeit — Zugangskontrolle",
    items: [
      "Zugang zur Anwendung nur über ein Konto mit bestätigter E-Mail-Adresse.",
      "Passwörter werden ausschließlich als scrypt-Hash gespeichert, nie im Klartext.",
      "Sitzungen werden serverseitig gegen die Datenbank geprüft, nicht allein anhand eines Cookies.",
      "Gesperrte Konten (is_blocked) verlieren den Zugriff sofort und vollständig.",
    ],
  },
  {
    title: "Vertraulichkeit — Zugriffs- und Trennungskontrolle",
    items: [
      "Jede Datenbankabfrage trägt eine Prüfung auf die Eigentümerschaft (user_id). Mandantentrennung ist damit nicht eine Sichtbarkeitsregel der Oberfläche, sondern Bedingung der Abfrage selbst.",
      "Jeder API-Endpunkt prüft die Authentifizierung serverseitig, bevor Daten gelesen oder geschrieben werden.",
      "Administrative Zugriffe sind auf einen namentlich festgelegten Personenkreis beschränkt und werden protokolliert.",
    ],
  },
  {
    title: "Integrität — Weitergabe- und Eingabekontrolle",
    items: [
      "Übertragung ausschließlich über TLS, erzwungen durch HSTS (max-age zwei Jahre, includeSubDomains).",
      "Content-Security-Policy mit Nonce, X-Frame-Options DENY, X-Content-Type-Options nosniff.",
      "Sämtliche Eingaben werden serverseitig gegen ein Schema validiert (Zod), bevor sie die Datenbank erreichen.",
      "Zahlungs-Webhooks werden kryptografisch signaturgeprüft und idempotent verarbeitet.",
      "Rate-Limiting gegen automatisierte Angriffe, insbesondere auf Anmeldung und Passwort-Zurücksetzen.",
    ],
  },
  {
    title: "Verfügbarkeit und Belastbarkeit",
    items: [
      "Nächtliche vollständige Sicherung der Datenbank, Ende-zu-Ende-verschlüsselt (age).",
      "Bei jedem Sicherungslauf wird die Sicherung testweise in eine Wegwerf-Datenbank zurückgespielt. Schlägt das fehl, gilt der Lauf als fehlgeschlagen.",
      "Zweite Kopie an einem räumlich getrennten Ort.",
      "Überwachung des Sicherungslaufs aus der Anwendung heraus, unabhängig vom Sicherungssystem selbst: bleibt die Sicherung länger als 36 Stunden aus, geht eine Meldung raus.",
    ],
  },
  {
    title: "Verfahren zur Überprüfung und Löschung",
    items: [
      "Kontolöschung entfernt alle Datenbankzeilen der betroffenen Person innerhalb einer Transaktion.",
      "Rechnungen, die der steuerlichen Aufbewahrungspflicht unterliegen, werden dabei vom Konto entkoppelt und mit ihrem Löschdatum versehen.",
      "Ein täglicher Lauf löscht Belege, deren Aufbewahrungsfrist abgelaufen ist.",
      "Automatisierte Sicherheits- und Abhängigkeitsprüfungen bei jeder Änderung am Quelltext.",
    ],
  },
];

export default function AvvPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <BackLink />
        <h1 className="text-2xl font-bold text-primary">Auftragsverarbeitungsvertrag</h1>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">Worum es hier geht</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            Wer Bilanz-Buddy nutzt, gibt Daten der eigenen Kundschaft ein — Namen, Anschriften,
            E-Mail-Adressen auf Aufträgen und Rechnungen. Für diese Daten sind{" "}
            <strong className="text-primary">Sie</strong> verantwortlich; Bilanz-Buddy verarbeitet sie
            nur in Ihrem Auftrag. Genau dafür verlangt Art. 28 Abs. 3 DSGVO einen Vertrag — diesen.
          </p>
          <p>
            Abzugrenzen davon sind <strong className="text-primary">Ihre eigenen</strong> Daten als
            Kontoinhaber:in: E-Mail-Adresse, Passwort-Hash, Firmenprofil, Abodaten. Dafür ist der
            Anbieter selbst Verantwortlicher, und es gilt die{" "}
            <Link href="/legal/datenschutz" className="text-brand-primary hover:text-brand-primary/80">
              Datenschutzerklärung
            </Link>
            .
          </p>
          <p className="text-muted">
            Dieser Vertrag kommt mit der Registrierung zustande und gilt, solange Ihr Konto besteht.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 1 Vertragsparteien und Gegenstand</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) <strong className="text-primary">Verantwortlicher</strong> im Sinne des Art. 4 Nr. 7
            DSGVO ist die Inhaberin oder der Inhaber des Bilanz-Buddy-Kontos.
          </p>
          <p>
            (2) <strong className="text-primary">Auftragsverarbeiter</strong> im Sinne des Art. 4
            Nr. 8 DSGVO ist Sebastian Grüber, DigitalFlowSolutions, Falkenweg 6, 38820 Halberstadt
            (nachfolgend „Anbieter&ldquo;).
          </p>
          <p>
            (3) Gegenstand ist die Verarbeitung personenbezogener Daten, die der Verantwortliche im
            Rahmen der Nutzung von Bilanz-Buddy eingibt oder importiert.
          </p>
          <p>
            (4) Der Vertrag beginnt mit der Registrierung und endet mit der Löschung des Kontos.
            Eine gesonderte Kündigung ist nicht erforderlich; er endet automatisch mit dem
            Nutzungsverhältnis.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 2 Art, Zweck und Umfang der Verarbeitung</h2>
        <div className="space-y-3 text-sm text-secondary leading-relaxed">
          <p>
            (1) <strong className="text-primary">Zweck:</strong> Bereitstellung der Funktionen von
            Bilanz-Buddy — Verwaltung von Aufträgen, Erstellung von Rechnungen, Erfassung von
            Marktverkäufen und Ausgaben, Auswertung für die Einnahmen-Überschuss-Rechnung sowie
            Export und Import der Daten.
          </p>
          <p>
            (2) <strong className="text-primary">Art der Verarbeitung:</strong> Erheben, Speichern,
            Ordnen, Auslesen, Verwenden, Übermitteln in Form von Exporten an den Verantwortlichen,
            Einschränken und Löschen.
          </p>
          <div>
            <p className="mb-1">(3) <strong className="text-primary">Datenarten:</strong></p>
            <ul className="space-y-1 list-disc list-inside">
              {DATA_CATEGORIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1">(4) <strong className="text-primary">Kreis der Betroffenen:</strong></p>
            <ul className="space-y-1 list-disc list-inside">
              {DATA_SUBJECTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p>
            (5) Besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO sind nicht Gegenstand
            dieses Vertrags. Der Verantwortliche gibt solche Daten nicht ein.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 3 Weisungsgebundenheit</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Der Anbieter verarbeitet die Daten ausschließlich auf dokumentierte Weisung des
            Verantwortlichen. Die Nutzung der Anwendung — jede Eingabe, jede Löschung, jeder Export
            — gilt als solche Weisung.
          </p>
          <p>
            (2) Weisungen darüber hinaus sind in Textform an{" "}
            <a
              href="mailto:info@digitalflowsolutions.de"
              className="text-brand-primary hover:text-brand-primary/80"
            >
              info@digitalflowsolutions.de
            </a>{" "}
            zu richten.
          </p>
          <p>
            (3) Hält der Anbieter eine Weisung für rechtswidrig, teilt er dies unverzüglich mit und
            darf ihre Ausführung aussetzen (Art. 28 Abs. 3 Satz 3 DSGVO).
          </p>
          <p>
            (4) Eine Verarbeitung zu eigenen Zwecken findet nicht statt. Insbesondere werden die
            Daten weder ausgewertet noch für Werbung oder Training von Modellen verwendet, und sie
            werden nicht an Dritte verkauft.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 4 Pflichten des Anbieters</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) <strong className="text-primary">Vertraulichkeit:</strong> Alle Personen, die
            Zugriff auf die Daten erhalten können, sind zur Vertraulichkeit verpflichtet (Art. 28
            Abs. 3 lit. b DSGVO).
          </p>
          <p>
            (2) <strong className="text-primary">Sicherheit:</strong> Der Anbieter unterhält die in
            Anlage 1 beschriebenen technischen und organisatorischen Maßnahmen (Art. 32 DSGVO). Er
            darf sie fortentwickeln, solange das Schutzniveau nicht unterschritten wird.
          </p>
          <p>
            (3) <strong className="text-primary">Unterstützung:</strong> Der Anbieter unterstützt
            den Verantwortlichen bei Anfragen betroffener Personen sowie bei
            Datenschutz-Folgenabschätzungen und der Meldung von Verletzungen (Art. 28 Abs. 3 lit. e
            und f DSGVO).
          </p>
          <p>
            (4) <strong className="text-primary">Meldung:</strong> Wird eine Verletzung des Schutzes
            personenbezogener Daten bekannt, informiert der Anbieter den Verantwortlichen
            unverzüglich, spätestens innerhalb von 48 Stunden nach Kenntnis, mit allen ihm
            vorliegenden Angaben.
          </p>
          <p>
            (5) <strong className="text-primary">Information:</strong> Der Anbieter benennt eine
            Kontaktstelle für Datenschutzfragen (§ 3 Abs. 2). Ein Datenschutzbeauftragter ist nach
            § 38 BDSG nicht zu bestellen.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 5 Unterauftragsverarbeiter</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Der Verantwortliche stimmt der Beauftragung der in Anlage 2 genannten
            Unterauftragsverarbeiter zu (allgemeine schriftliche Genehmigung nach Art. 28 Abs. 2
            DSGVO).
          </p>
          <p>
            (2) Wechsel oder Hinzunahme werden mindestens vier Wochen vorher per E-Mail angekündigt.
            Der Verantwortliche kann binnen dieser Frist aus wichtigem, datenschutzrechtlichem Grund
            widersprechen; kommt keine Einigung zustande, darf er außerordentlich kündigen und sein
            Konto löschen. Der Datenexport bleibt bis zur Löschung möglich.
          </p>
          <p>
            (3) Der Anbieter verpflichtet jeden Unterauftragsverarbeiter auf ein Schutzniveau, das
            diesem Vertrag entspricht.
          </p>
          <p>
            (4) <strong className="text-primary">Drittlandtransfer:</strong> Soweit ein
            Unterauftragsverarbeiter außerhalb der EU/des EWR sitzt, erfolgt die Übermittlung auf
            Grundlage der Standardvertragsklauseln der EU-Kommission und, soweit anwendbar, einer
            Zertifizierung nach dem EU-US Data Privacy Framework.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 6 Rechte der betroffenen Personen</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Anfragen betroffener Personen beantwortet der Verantwortliche. Wendet sich jemand
            unmittelbar an den Anbieter, leitet dieser die Anfrage unverzüglich weiter und beantwortet
            sie nicht selbst.
          </p>
          <p>
            (2) Auskunft, Berichtigung und Löschung kann der Verantwortliche jederzeit selbst in der
            Anwendung vornehmen; für die Datenübertragbarkeit steht der vollständige Export als JSON
            bereit. Dieser Zugriff bleibt auch dann bestehen, wenn das Konto mangels Abonnement im
            Nur-Lese-Modus ist.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 7 Nachweise und Kontrollen</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Der Anbieter weist die Einhaltung seiner Pflichten auf Anfrage in geeigneter Weise
            nach, insbesondere durch die Beschreibung der Maßnahmen in Anlage 1 und die Nachweise
            seiner Unterauftragsverarbeiter.
          </p>
          <p>
            (2) Der Verantwortliche kann sich nach angemessener Vorankündigung von der Einhaltung
            überzeugen. Vor-Ort-Kontrollen sind auf das Erforderliche zu beschränken und dürfen den
            Betrieb nicht unangemessen stören.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 8 Löschung nach Vertragsende</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Nach Ende des Vertrags löscht der Anbieter alle verarbeiteten Daten. Die Löschung
            wird durch die Kontolöschung in den Einstellungen ausgelöst und erfolgt sofort.
          </p>
          <p>
            (2) <strong className="text-primary">Ausnahme steuerliche Aufbewahrung:</strong>{" "}
            Ausgestellte Rechnungen unterliegen der gesetzlichen Aufbewahrungspflicht (§ 147 AO,
            § 14b UStG). Sie werden vom Konto entkoppelt, für die Dauer der Frist aufbewahrt und
            danach gelöscht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. c DSGVO; die Löschpflicht ist
            insoweit nach Art. 17 Abs. 3 lit. b DSGVO eingeschränkt.
          </p>
          <p>
            (3) <strong className="text-primary">Ausnahme Sicherungen:</strong> In den
            verschlüsselten Sicherungskopien können die Daten bis zum Ablauf des jeweiligen
            Aufbewahrungszeitraums der Sicherung fortbestehen. Sie werden dort nicht mehr genutzt
            und laufen mit dem Zyklus aus.
          </p>
          <p>
            (4) Der Verantwortliche ist selbst dafür zuständig, seine Daten vor der Löschung zu
            exportieren.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 9 Pflichten des Verantwortlichen</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Der Verantwortliche ist für die Rechtmäßigkeit der Verarbeitung und für die
            Erfüllung der Informationspflichten gegenüber seiner Kundschaft zuständig.
          </p>
          <p>
            (2) Er gibt keine Daten ein, für deren Verarbeitung ihm die Grundlage fehlt, und keine
            besonderen Kategorien nach Art. 9 DSGVO.
          </p>
          <p>
            (3) Er hält seine Zugangsdaten geheim. Der Anbieter kann nicht unterscheiden, ob eine
            Eingabe von der berechtigten Person stammt.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">§ 10 Schlussbestimmungen</h2>
        <div className="space-y-2 text-sm text-secondary leading-relaxed">
          <p>
            (1) Bei Widersprüchen zwischen diesem Vertrag und den{" "}
            <Link href="/legal/agb" className="text-brand-primary hover:text-brand-primary/80">
              AGB
            </Link>{" "}
            gehen die Regelungen dieses Vertrags vor.
          </p>
          <p>(2) Es gilt das Recht der Bundesrepublik Deutschland.</p>
          <p>
            (3) Ist eine Bestimmung unwirksam, bleibt der übrige Vertrag wirksam. An ihre Stelle
            tritt, was ihrem Zweck rechtlich zulässig am nächsten kommt.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">
          Anlage 1 — Technische und organisatorische Maßnahmen (Art. 32 DSGVO)
        </h2>
        <div className="space-y-4">
          {TOMS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium text-primary mb-1">{group.title}</h3>
              <ul className="space-y-1 text-sm text-secondary list-disc list-inside">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-primary mb-3">
          Anlage 2 — Genehmigte Unterauftragsverarbeiter
        </h2>
        <div className="space-y-4">
          {SUBPROCESSORS.map((sub) => (
            <div key={sub.name}>
              <h3 className="text-sm font-medium text-primary">{sub.name}</h3>
              <p className="text-xs text-muted mb-1">{sub.country}</p>
              <p className="text-sm text-secondary leading-relaxed">{sub.purpose}</p>
            </div>
          ))}
          <p className="text-sm text-secondary leading-relaxed">
            Nicht in dieser Liste steht der Zahlungsdienstleister Stripe: er verarbeitet
            ausschließlich die Abodaten des Verantwortlichen selbst und erhält keine Daten von
            dessen Kundschaft. Dasselbe gilt für den Mailversand über STRATO, der nur an die
            Kontoinhaberin oder den Kontoinhaber zustellt. Beides ist in der{" "}
            <Link href="/legal/datenschutz" className="text-brand-primary hover:text-brand-primary/80">
              Datenschutzerklärung
            </Link>{" "}
            beschrieben.
          </p>
        </div>
        <p className="text-sm text-muted mt-4">
          Fassung {AVV_VERSION} — Stand: {AVV_STAND}
        </p>
      </Card>
    </div>
  );
}
