# E-Rechnung – Readiness & Ausbauplan (Phase 2.5)

> **Status: vorbereitet, nicht gebaut.** Bilanz-Buddy erzeugt heute PDF-Rechnungen.
> Ein strukturiertes E-Rechnungsformat (ZUGFeRD/XRechnung) ist **nicht**
> implementiert. Dieses Dokument hält fest, was das Datenmodell bereits abdeckt
> und was für eine spätere Umsetzung ergänzt werden muss.

## Rechtlicher Rahmen (Kurzfassung, ohne Gewähr)

- **Empfang:** B2B-Unternehmen müssen strukturierte E-Rechnungen empfangen können
  (seit 2025). Betrifft Bilanz-Buddy nur als Empfänger-Thema, nicht die Ausstellung.
- **Ausstellungspflicht:** wird stufenweise wirksam (2027/2028, umsatzabhängig).
- **Kleinunternehmer (§ 19 UStG):** von der **Ausstellungspflicht** dauerhaft
  befreit; dürfen weiter einfache Rechnungen (auch PDF) ausstellen. Da Bilanz-Buddys
  Zielgruppe überwiegend Kleinunternehmer sind, ist E-Rechnung eine **Ausbaustufe**,
  kein akuter Zwang.

## Bereits strukturiert vorhanden (aus Phase 2.1/2.2)

Der unveränderliche Rechnungs-Snapshot (`invoices`) hält alle Kernfelder bereits
strukturiert – nicht als Freitext:

- **Beträge als Integer-Cents:** `subtotal`, `shippingCost`, `total`; je Position
  `{ name, quantity, price }` (Einzelpreis in Cents).
- **Leistungsdatum** (`serviceDate`) und **Rechnungsdatum** (`issueDate`) getrennt.
- **Verkäufer** strukturiert: `sellerName`, `sellerAddress`, `sellerEmail`, `sellerPhone`.
- **Empfänger** strukturiert: `customerName`, `customerEmail`, `customerStreet`,
  `customerZip`, `customerCity`, `customerCountry`.
- **Rechnungsnummer** (eindeutig je Nutzer), **Typ** (`invoice`/`cancellation`),
  **Storno-Referenz** (`cancelsInvoiceId`).
- **Steuerhinweis** (`taxNote`) + **Kleinunternehmer-Flag** (`isSmallBusiness`).

Damit sind die Pflichtangaben nach § 14 UStG als Datenfelder abbildbar; das PDF
wird deterministisch aus dem Snapshot erzeugt (`buildInvoicePdf`).

## Für ZUGFeRD/XRechnung später zu ergänzen (bewusst offen)

| Lücke | Wofür | Anmerkung |
|---|---|---|
| **USt je Position** (Steuersatz + Steuerbetrag) | Regelbesteuerung (Nicht-KU) | Für KU = 0 %/entfällt. Ergänzung: `taxRate` + abgeleiteter Steuerbetrag je Zeile + Summen je Satz. |
| **Strukturierte Steuer-IDs** (USt-IdNr., Steuernummer) | Pflichtfeld strukturierter Formate | Heute im Freitext `taxNote`. Als diskrete Felder am Firmenprofil + Snapshot ergänzen. |
| **Leitweg-ID des Empfängers** | XRechnung an öffentliche Auftraggeber | Nur für B2G relevant; optionales Empfängerfeld. |
| **Währung** | Mehrwährungsfähigkeit | Aktuell implizit EUR; `currency`-Feld mit Default `EUR`. |
| **Mengeneinheit je Position** | ZUGFeRD-Positionszeile | z. B. „Stück/Stk"; heute nur `quantity`. |
| **Zahlungsbedingungen / IBAN** | strukturierte Zahlungsinfos | heute ggf. im Freitext. |

## Ausbau-Ansatz (wenn es so weit ist)

1. Fehlende Felder **additiv** an `invoices` (und ggf. `company_profiles`) ergänzen
   – niemals bestehende Snapshots ändern (Immutabilität bleibt gewahrt).
2. Ein `buildInvoiceXml()` (ZUGFeRD/UN-CEFACT bzw. XRechnung/UBL) **neben**
   `buildInvoicePdf()` bauen; für ZUGFeRD die XML in das PDF/A-3 einbetten.
3. Der Snapshot friert bereits alles Nötige ein – die Erzeugung bleibt
   deterministisch und byte-reproduzierbar.

**Fazit:** Das Datenmodell ist erweiterbar gehalten; für die Zielgruppe
(Kleinunternehmer) besteht kein akuter Handlungsbedarf. Umsetzung erst, wenn
Regelbesteuerung/B2B-Pflicht relevant wird.
