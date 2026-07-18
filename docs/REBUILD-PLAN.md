# Vendora 2.0 — Überarbeitungsplan (Umsetzungsauftrag für KI-Agenten)

> **Zweck dieses Dokuments:** Vollständiger, eigenständiger Arbeitsauftrag für die komplette Überarbeitung von Vendora.
> Es enthält (1) den Ist-Zustand mit allen relevanten Fakten und Dateipfaden, (2) alle bekannten Fehler und Schulden,
> (3) das Zielbild und (4) einen phasenweisen Umsetzungsplan mit Abnahmekriterien.
> Erstellt am 2026-07-18 auf Basis einer Komplettanalyse von Code, Security-Audits und zwei Strategiedokumenten
> (Marktanalyse-Dossier Juli 2026, Strategiebericht „Monetarisierung ohne Abo-Zwang").
>
> **▶ Aktueller Fortschritt & Handoff: [`docs/PROGRESS.md`](./PROGRESS.md).**
> Stand 2026-07-18: **Phase 0 und Phase 1 erledigt** (Branch `migrate/neon-betterauth`). Nächste offene Phase: **Phase 2**.

---

## 0. Arbeitsregeln (verbindlich)

1. **Grundfeatures bleiben erhalten:** (a) EÜR-Übersicht + einfacher Steuer-Export, (b) Aufträge + Rechnungsstellung, (c) Ausgaben-/Einkaufsaufstellung, (d) Marktmodus. Nichts davon entfernen — nur verbessern.
2. **Verifikation nach jeder Änderung** (Reihenfolge, alle vier grün, erst dann committen):
   `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build`
3. **Security-Regeln aus `CLAUDE.md` gelten ausnahmslos:** jeder Route Handler prüft `getAuthUserId()` (401 bei null), jede Query hat `WHERE user_id`, Zod für jeden Input, keine Secrets im Client, Stripe-Webhook signaturverifiziert und fail-closed, Multi-Step-DB-Ops in Transaktionen.
4. **Next.js 16 beachten:** Vor Codeänderungen die Guides in `node_modules/next/dist/docs/` lesen. Es gibt **kein `middleware.ts`** mehr — die Proxy-Konvention ist `src/proxy.ts` (Node-Runtime).
5. Phasen **in Reihenfolge** abarbeiten. Jede Phase endet mit grünem Verifikationslauf + Commit(s) mit klarer Message. Branch-Basis: `migrate/neon-betterauth` (2 Commits ahead of `master`).
6. Bei Entscheidungen, die hier nicht festgelegt sind (z. B. exakte Preise, Anbieterwahl für Objekt-Storage): sinnvollen Default wählen, im Code/README dokumentieren, weiterarbeiten.

---

## 1. Produktkontext & Positionierung

Vendora ist eine Multi-Tenant-SaaS für **kreative Markthändler:innen in Deutschland** (Kunsthandwerk auf Wochen-, Kunsthandwerker- und Weihnachtsmärkten). Erkenntnisse aus der Marktanalyse (Juli 2026):

- **Echter Whitespace:** Kein deutscher Direktwettbewerber für die Händlerseite. Hauptgegner sind Excel/Papier und niedrige Zahlungsbereitschaft.
- **Personas:**
  - „Kreativ-Katrin": Nebenerwerb, Kleinunternehmerin § 19 UStG, 5–15 Märkte/Jahr, Budget 5–15 €/Monat, Gratis-Erwartung.
  - „Vollzeit-Volker": Haupterwerb, mehrere Märkte/Woche, TSE-/Kassenthema relevant, 20–50 €/Monat bei klarem ROI.
  - „Marktveranstalter-Martina": B2B2C-Multiplikatorin (Standbuchung/Ausstellerverwaltung) — wichtigster Vertriebskanal.
- **Must-haves laut Analyse:** Marktkalender + Umsatz/Kosten je Markt, **Offline-Fähigkeit** (schlechter Empfang auf Marktgeländen), mobile Kasse/TSE-Anbindung (SumUp als Partner, nicht selbst bauen), einfache Bestandsführung, sehr niedriger Preis.
- **Monetarisierungsstrategie (Strategiebericht):** KEIN Abo-Zwang. Stattdessen: Free-Basis + Pay-per-Use/Credits (1–3 €/Markttag), Premium-Einmalkäufe (Steuer-/DATEV-Jahresexport 9–19 €), Hardware-Referrals (SumUp/ready2order), Versicherungs-Affiliate; mittelfristig **Veranstalter-Modul** mit Take-Rate/Pro-Stand-Gebühr als Haupthebel; optional Stripe-Connect-Application-Fee (0,3–0,5 Pp) additiv. Lifetime-Deals nur als einmalige Launch-Kampagne. Pivot-Benchmarks: Free→Paid < 2 % oder ARPU < 8 € → Richtung B2B2C/Provisionsmodell pivotieren.
- **Leitbild:** „Wisse, welcher Markt sich lohnt." Der Markt ist der Kern der Domäne, nicht ein Nebenfeature.

**Bewusst NICHT bauen:** eigene TSE-Kasse (nur SumUp-Anbindung/Empfehlung), Etsy-/Shopify-Sync (v1), volle Warenwirtschaft/Produktkatalog, native Apps (PWA reicht), Verkauf von Benchmark-Daten.

---

## 2. Ist-Zustand (verifizierte Fakten)

### 2.1 Stack & Struktur

- Next.js `^16.2.3` (App Router), React 19.2.4, TypeScript strict, Better Auth `^1.6.23` (Drizzle-Adapter), Drizzle `^0.45.2` + `postgres` gegen Neon, Stripe `^22.0.1`, Zod v4, TanStack Query v5, Arcjet (Rate-Limiting in `src/proxy.ts`), Resend, Tailwind v4, Vitest.
- ~10.300 Zeilen in `src/`, 28 API-Routen.
- **Schema liegt in `src/lib/server/schema.ts`** (nicht `src/lib/schema.ts`, wie CLAUDE.md behauptet). Auth-Tabellen: `src/lib/server/auth-schema.ts`. DB-Zugriff zentral in `src/lib/server/storage.ts` (591 Zeilen). React-Query-Setup: `src/lib/api-client.ts` (user-scoped Query-Keys `[userId, '/api/...']`).
- Auth: `src/lib/auth.ts` (Better Auth Config, `requireEmailVerification: false` bis Resend live ist), `src/lib/server/auth.ts` (`getAuthUserId`, `requireActiveSubscription`), `src/lib/server/admin.ts` (`requireAdmin` via `ADMIN_EMAILS`-Env).
- i18n: hartkodiertes Übersetzungsobjekt in `src/lib/i18n.ts` (DE/EN), Sprache/Theme in localStorage (`LanguageContext`, `ThemeContext`). Teils Inline-Ternaries statt `t`-Objekt.
- Fast alle Seiten sind Client-Components; Session-Gate im Server-Layout `src/app/(app)/layout.tsx`.

### 2.2 Features heute

| Bereich | Stand |
|---|---|
| Dashboard | `src/app/(app)/dashboard/page.tsx` (406 Z.): Umsatz (bezahlte Aufträge + Marktverkäufe), Ausgaben, Nettogewinn, Monatstabelle, Jahresfilter. „GuV-Export" = HTML-String → `window.print()`. Keine Charts. |
| Aufträge | Voller CRUD (`orders/`, 4 Seiten), Positionen, Status `open/paid/shipped/delivered/cancelled`, Zod-validiert. Rechnungsnummern fortlaufend `YY-NNN` über `invoice_counters` (atomarer Upsert in `getNextInvoiceNumber`). |
| Rechnung | `handleCreateInvoice` in `orders/[id]/page.tsx` (Z. 87–243): HTML-Rechnung im neuen Fenster mit Auto-Print. **Nicht gespeichert, kein PDF, nachträglich änderbar, kein Storno.** |
| Ausgaben | `expenses/page.tsx` + API: CRUD, 7 hartkodierte Client-Kategorien (Freitext in DB), keine Belege, keine USt. |
| Marktmodus | `markets/[id]/page.tsx` (378 Z.): Quick-Sale-Buttons aus `quickItems` (jsonb), manuelle Verkäufe, Live-Gewinn (Verkäufe − Standgebühr − Fahrtkosten), Markt kopieren (`api/markets/[id]/copy`). **Online-only** — jeder Sale ist ein sofortiger POST. |
| Export/Backup | `api/export` (JSON-Bundle, schemaVersion 1), `api/migrate` (285 Z., komplett transaktionaler Restore mit Zod-Caps und Legacy-Feld-Mapping, Import nur bei `subscriptionStatus === "active"`). |
| Settings/Konto | `settings/page.tsx` (642 Z., größte Datei). DSGVO-Löschung: Stripe-Customer löschen → Transaktion (alle Daten + Soft-Delete-Profil + Better-Auth-User). |
| Admin | `admin/`-Seiten + APIs (`extend_trial`, `activate_subscription`, `block`, `unblock`), Gate via `ADMIN_EMAILS`. |
| Billing | Abo 2,99 €/Monat (`STRIPE_PRICE_ID` **hartkodiert** in `src/lib/server/stripe.ts`), 42-Tage-Trial (`provisioning.ts`), `requireActiveSubscription()` gated alle Schreib-Endpunkte. Webhook: signaturverifiziert, fail-closed, aber **kein Event-ID-Dedup**; `checkout.session.completed` setzt pauschal +30 Tage. |

**Tote Pfade:** `api/customers` + `useCustomers()` (nie aufgerufen), `api/invoice-number` (kein UI-Caller), `app_settings`-Tabelle + Settings-PUT (Theme/Sprache liegen in localStorage). **Nicht existent trotz Doku:** Produktkatalog/`api/products`, `docs/known-issues.md`, `docs/security-policy.md`, `docs/database-schema.md`, `docs/stripe-integration.md`, `docs/development-workflow.md`.

### 2.3 Datenmodell (Kurzfassung)

Tabellen in `src/lib/server/schema.ts`: `users` (App-Profil, `id` = Better-Auth-User-ID, subscriptionStatus/trialEndsAt/stripe*/isBlocked/deletedAt), `orders` (+ Kundenfelder, `invoiceNumber`, `total`), `order_items`, `market_events` (standFee, travelCost, `quickItems` jsonb, status), `market_sales`, `expenses`, `company_profiles` (1:1, taxNote, smallBusinessNote), `app_settings` (ungenutzt), `invoice_counters`. Better Auth: `user`, `session`, `account`, `verification` in `auth-schema.ts`.

**Strukturprobleme:**
- **Geld = `numeric` ohne Precision → `parseFloat` → JS-Float-Arithmetik** (`toFixed(2)`, `Math.round(x*100)/100`).
- **Datumsfelder der Domäne sind `text`** (ISO-Strings); nur Auth-Tabellen haben echte Timestamps.
- **Kein `paidAt`/Zahlungsdatum, keine Zahlungsart** auf Orders; Umsatz wird nach `orderDate` gebucket.
- **Keine versionierten Migrationen:** `drizzle/`-Ordner existiert nicht mehr, Deployment nur via `drizzle-kit push`.

### 2.4 Bestätigte Fehler & offene Findings

**Fachlich/Bugs:**
1. **Marktkosten fehlen in der GuV:** `dashboard/page.tsx` summiert nur `expenses`; `standFee`/`travelCost` aus `market_events` kommen im Dashboard/GuV-Export nicht vor → ausgewiesener Gewinn systematisch zu hoch. (Verifiziert.)
2. Stripe-Webhook: kein Event-ID-Dedup → Replay von `customer.subscription.deleted` kann aktives Abo canceln; 3× `console.log` im Webhook; +30-Tage-Hardcode statt Subscription-Periode auslesen.
3. `getAuthUserId` lässt User ohne App-Profilzeile passieren (`dbUser?.isBlocked || dbUser?.deletedAt` ist bei fehlender Zeile falsy) — Lücke falls `ensureUserRecord`-Hook fehlschlägt.

**Rechtlich:**
4. **Datenschutzerklärung nennt „Supabase Inc." als Auftragsverarbeiter** (`src/app/legal/datenschutz/page.tsx` Z. 61–66) — real sind es Neon, Better Auth (selbst gehostet in DB), Resend, Vercel, Stripe. Falsche Pflichtangabe, dringend.
5. **GoBD/AO-Konflikt:** Rechnungen nach Nummernvergabe editierbar; Account-Löschung vernichtet Rechnungsdaten trotz 10-jähriger Aufbewahrungspflicht (§ 147 AO, § 14b UStG; Art. 17 Abs. 3 lit. b DSGVO erlaubt Aufbewahrung).

**Tech-Debt (offen aus Audits B1–B7/M1–M4/L1–L3):** Trial-Abuse via E-Mail-Aliase, keine Pagination (kein `limit()` in storage.ts), Admin via Env-Whitelist, kein `server-only`-Import in Server-Modulen, Rate-Limiting nur IP-basiert, CSP mit `unsafe-inline` für Styles, keine Env-Validierung (`process.env.DATABASE_URL!`), Preview-Deployments gegen Produktionsdaten.
**Doku:** CLAUDE.md-Pfade/Funktionen teils falsch (`getAuthUserIdStrict` existiert nicht, Schema-Pfad falsch, Produktkatalog existiert nicht), SETUP.md komplett Supabase-Stand, README = create-next-app-Boilerplate.
**Tests/CI:** 50 Vitest-Tests, aber teils Source-Grep-Assertions und lokal duplizierte Zod-Schemas (Drift-Gefahr); keine Integrationstests; `@testing-library/react` ungenutzt; CI (`.github/workflows/security.yml`) triggert nur auf `master`, nicht auf Feature-Branches.
**Hinweis:** Remote-Branch `claude/pwa-offline-marktmodus-of3xb2` = früherer Anlauf für Offline-Marktmodus; vor Phase 3 auf Verwertbarkeit prüfen.

---

## 3. Zielbild

Vendora wird das **offline-fähige, mobile „Betriebssystem für Markthändler"**: Marktkalender + Kassen-light-Marktmodus + GoBD-feste Rechnungen + echte EÜR mit Steuer-Export — monetarisiert ohne Abo-Zwang (Free-Basis, Pay-per-Use, Einmalkäufe, Referrals, später Veranstalter-Modul). Die vier Säulen ruhen auf einem korrigierten Fundament (Cents, echte Datumstypen, versionierte Migrationen, GoBD-konforme Persistenz).

---

## 4. Umsetzungsplan

### Phase 0 — Fundament & Pflichtreparaturen

**0.1 Rechtstexte (sofort, unabhängig):**
- `src/app/legal/datenschutz/page.tsx`: Supabase-Absatz ersetzen durch korrekte Auftragsverarbeiter: Neon (DB, EU-Region angeben), Vercel (Hosting), Stripe (Zahlungen), Resend (E-Mail), Arcjet (Rate-Limiting). Better Auth läuft in eigener DB (kein externer Prozessor). Abschnitt zur Rechnungsdaten-Aufbewahrung ergänzen (Vorgriff auf Phase 2).

**0.2 Geld auf Integer-Cents:**
- Alle Betragsspalten (`orders.total`, `orders.shippingCost`, `order_items.price`, `market_events.standFee`/`travelCost`, `market_sales.amount`, `expenses.amount`, `company_profiles.defaultShippingCost`, `quickItems[].price`) auf `integer` (Cents) umstellen.
- `storage.ts`-Mapper, alle Zod-Schemas, `formatCurrency`, Formulare (Eingabe in Euro → Cents-Konvertierung an einer Stelle) anpassen. Keine Float-Arithmetik mehr auf Beträgen.

**0.3 Echte Datumstypen:** `orderDate`, `serviceDate`, `expenseDate`, `market_events.date` → `date`; alle `createdAt`/`updatedAt`-Textspalten → `timestamptz`.

**0.4 Versionierte Migrationen:** `drizzle-kit generate` einrichten, initiale Migration aus aktuellem Schema erzeugen, ab jetzt jede Schemaänderung als Migration. `db:push` nur noch für lokale Experimente.

**0.5 Härtung:**
- `webhook_events`-Tabelle (`eventId` PK, `processedAt`); Webhook verarbeitet jede Event-ID genau einmal. `console.log` im Webhook entfernen. Ablauf aus `subscription.current_period_end` lesen statt +30 Tage.
- `getAuthUserId`: fehlende App-Profilzeile → `null` (fail-closed).
- Env-Validierung: `src/lib/server/env.ts` mit Zod-Schema für alle Server-Envs, beim Modul-Load geprüft; `process.env.X!`-Zugriffe ersetzen.
- `import "server-only"` in alle `src/lib/server/*`-Module.
- Pagination (`limit`/`offset`, Default-Limit) für GET-Listen (orders, expenses, market-sales).
- CI: Workflow auch auf Push/PR aller Branches triggern; `typecheck`-Script in package.json ergänzen.

**0.6 Doku & Leichen:**
- CLAUDE.md korrigieren (Schema-Pfad, reale Exports, Produktkatalog raus, Docs-Liste auf reale Dateien), SETUP.md auf Neon/Better-Auth-Stand neu schreiben, README minimal projektspezifisch.
- `api/customers`/`useCustomers` bleibt (wird Phase 2 angeschlossen); `api/invoice-number`-Route löschen; `app_settings` + Settings-PUT entweder löschen oder bewusst behalten und dokumentieren (Empfehlung: löschen, localStorage ist ok).

**Abnahme Phase 0:** Alle 4 Checks grün; keine `numeric`-Beträge und keine text-Datumsspalten mehr im Schema; Webhook-Replay-Test (gleiche Event-ID zweimal → einmal verarbeitet); Datenschutzerklärung ohne Supabase; Migrationsordner mit Initial-Migration im Repo.

### Phase 1 — Säule EÜR & Steuer

**1.1 Zahlungsdaten:** `orders.paidAt` (`date`, nullable) + `orders.paymentMethod` (`cash`/`card`/`transfer`/`paypal`/`other`). Beim Statuswechsel auf `paid` wird `paidAt` gesetzt (UI: Datum vorbelegt heute, änderbar). Marktverkäufe gelten am Markttag als zugeflossen.

**1.2 Einheitliches Ausgabenmodell (behebt GuV-Bug strukturell):**
- `expenses.marketId` (nullable FK) + `expenses.source` (`manual`/`market_fee`/`market_travel`).
- Beim Anlegen/Ändern eines Markts werden Standgebühr/Fahrtkosten automatisch als verknüpfte Ausgaben-Zeilen gepflegt (Upsert bei Änderung, Löschung bei Markt-Löschung — in Transaktion). Dashboard/EÜR summieren nur noch `expenses` — damit sind Marktkosten genau einmal drin.

**1.3 EÜR-Kategorien:** Serverseitige Kategorie-Enum mit Mapping auf Anlage-EÜR-Sinnzeilen (mind.: Wareneinkauf/Material, Standgebühren/Raumkosten, Fahrtkosten, Arbeitsmittel/GWG, Verpackung, Marketing, Versicherungen/Beiträge, Software/Gebühren, Sonstiges). Bestehende Freitext-Kategorien migrieren (Mapping-Tabelle im Migrationsskript).

**1.4 Kleinunternehmer-Flag:** `company_profiles.isSmallBusiness` (boolean, Default true) statt Freitext-Steuerung; steuert Rechnungshinweis (§ 19 UStG) und EÜR-Darstellung. `taxNote`/`smallBusinessNote` bleiben als Zusatztexte.

**1.5 EÜR-Ansicht & Export:**
- Neue Seite `steuer/` (oder Tab im Dashboard): Jahresauswahl, Einnahmen nach Zufluss (`paidAt` bzw. Markttag), Ausgaben nach Kategorien, Überschuss; Gegenüberstellung nach EÜR-Logik.
- Export: CSV (eine Zeile je Beleg + Summenblatt) und PDF serverseitig. DATEV-Format (SKR03-Konten) als Ausbaustufe vorbereiten (Mapping-Struktur anlegen, Export optional).
- Dashboard: Charts (z. B. Recharts) für Monatsverlauf + **„Gewinn je Markt"-Ranking** (Kern-Kennzahl der Zielgruppe).

**Abnahme Phase 1:** EÜR-Summen stimmen gegen manuell gerechnetes Testszenario (inkl. Marktkosten, Zuflussprinzip); Ausgaben enthalten Markt-Gebühren genau einmal; CSV/PDF-Export lädt herunter; Tests für Zufluss-Bucketing und Markt-Ausgaben-Sync.

### Phase 2 — Säule Aufträge & Rechnungen (GoBD)

**2.1 `invoices`-Tabelle:** Unveränderlicher Snapshot bei Rechnungserstellung: Nummer, Datum, Absender (aus Profil), Empfänger, Positionen (jsonb-Snapshot), Beträge (Cents), Steuerhinweise, `orderId`-Referenz, `status` (`issued`/`cancelled`), `pdfUrl`. Kein UPDATE auf ausgestellte Rechnungen — Korrektur nur über **Stornorechnung** (neue Nummer, negativer Betrag, Referenz auf Original) + Neuausstellung.

**2.2 Server-PDF:** PDF-Erzeugung serverseitig (z. B. `pdf-lib` oder `@react-pdf/renderer`), Ablage in Objekt-Storage (Vercel Blob oder Neon Object Storage — eines wählen, dokumentieren), `pdfUrl` speichern. Die HTML-Print-Funktion wird durch „PDF herunterladen/erneut laden" ersetzt. GuV-/EÜR-PDF (Phase 1) nutzt dieselbe Infrastruktur — gemeinsames Template-Modul statt duplizierter HTML-Strings in `orders/[id]/page.tsx` und `dashboard/page.tsx`.

**2.3 Aufbewahrung vs. DSGVO:** Account-Löschung anonymisiert das Konto und löscht alle Nicht-Beleg-Daten, **archiviert aber Rechnungen** (userId-Entkopplung, Aufbewahrungstabelle mit Löschfrist +10 Jahre). In Datenschutzerklärung dokumentieren. `api/export` um Rechnungen erweitern.

**2.4 Kundenstamm:** `customers`-Tabelle (user-scoped: Name, E-Mail, Adresse), Auftragsformular mit Autocomplete (vorhandene tote Route `api/customers` + `useCustomers()` anschließen/umbauen), Migration: distinct-Kunden aus bestehenden Orders übernehmen. Orders referenzieren optional `customerId`, behalten aber den Snapshot der Adressfelder.

**2.5 E-Rechnung (nur vorbereiten, nicht bauen):** Datenmodell so halten, dass ZUGFeRD/XRechnung später ergänzbar ist (strukturierte Beträge, Leistungsdatum vorhanden). Kleinunternehmer sind von der Ausstellungspflicht dauerhaft befreit; B2B-Versandpflicht greift 2027/2028 — Ausbaustufe.

**Abnahme Phase 2:** Rechnung erzeugen → PDF gespeichert + identisch reproduzierbar; Auftrag nachträglich ändern → Rechnung unverändert; Storno-Flow funktioniert; Account-Löschung erhält Rechnungsarchiv; Integrationstests für Rechnungs-Immutabilität.

### Phase 3 — Säule Marktmodus (Offline-First-PWA)

Vorab: Branch `claude/pwa-offline-marktmodus-of3xb2` sichten; Verwertbares übernehmen.

**3.1 PWA-Basis:** Manifest, Icons, Service Worker (App-Shell-Caching), installierbar. Next-16-kompatible Lösung wählen (z. B. `serwist`).

**3.2 Offline-Verkaufserfassung:** Marktmodus-Seite schreibt Sales in lokale Queue (IndexedDB); Sync-Worker pusht bei Konnektivität an `api/markets/[id]/sales` (idempotent via Client-generierter Sale-UUID — Server akzeptiert `id` und dedupliziert). UI zeigt Sync-Status (n ausstehend / synchronisiert). Konflikte sind unkritisch (append-only Verkäufe).

**3.3 Kassen-UX:** Vollbild-Marktmodus: große Touch-Buttons (quickItems), Bar/Karte-Toggle je Verkauf (`market_sales.paymentMethod`), Mengen-Steps, Undo für Fehleingaben, **Tagesabschluss-Ansicht** (Umsatz gesamt/bar/Karte, Verkäufe-Liste, Gewinn nach Kosten). Klarstellung im UI: Vendora ist keine Registrierkasse (keine TSE) — Hinweis + SumUp-Empfehlung (Referral-Link-Slot, s. Phase 4).

**3.4 Marktkalender:** `market_events` erweitern: `applicationDeadline` (`date`), Status erweitern um `applied`/`confirmed` (bestehende: `open`/`completed`/`cancelled`); Kalender-/Listenansicht mit Fristen; „Markt kopieren" zu Serien-Konzept ausbauen (Vorjahres-Vergleich je Markt: gleicher Name → Jahresvergleich Umsatz/Gewinn).

**Abnahme Phase 3:** Flugmodus-Test: Markt öffnen → 5 Verkäufe erfassen → online gehen → alle 5 exakt einmal auf Server; Lighthouse-PWA-Check installierbar; Tagesabschluss zeigt korrekte Bar/Karte-Summen.

### Phase 4 — Monetarisierungs-Umbau (ohne Abo-Zwang)

**4.1 Free-Basis statt 42-Tage-Trial:** `requireActiveSubscription`-Gates ersetzen durch Feature-Limits (Vorschlag als Default: Free = max. 2 aktive Märkte/Monat, max. 5 Rechnungen/Monat, EÜR-Ansicht ja, Jahres-Export nein). Limits serverseitig durchsetzen (nicht nur UI). Bestehende Trial-/Abo-Statuslogik zu `plan`-Feld (`free`/`pro`/`credits`) migrieren; Admin-Aktionen anpassen.

**4.2 Pay-per-Use/Credits:** Credits-Tabelle (user-scoped Saldo, Ledger mit Buchungen); Stripe-Checkout für Credit-Pakete (Einmalzahlungen statt Subscription); 1 Credit = 1 aktiver Markttag über Free-Limit (Preisrahmen 1–3 €/Markttag laut Strategiebericht). Optionales kleines Pro-Abo (9–19 €/Monat, alle Limits aufgehoben) für Power-User behalten — als Option, nicht als Zwang. `STRIPE_PRICE_ID`-Hardcode durch Env/Config mit mehreren Preisen ersetzen.

**4.3 Premium-Einmalkäufe:** EÜR-/DATEV-**Jahresexport als Einmalkauf 9–19 €** (Stripe One-time Payment, freigeschaltet pro Steuerjahr). Free-User sehen die EÜR-Ansicht, zahlen für den Export.

**4.4 Referral-Slots:** Konfigurierbare Empfehlungs-Platzierungen (SumUp-Kartenleser im Marktmodus/Tagesabschluss, Betriebshaftpflicht-Vergleich in Settings/Onboarding). Affiliate-Links als Env-Config; Kennzeichnung als Werbung (UWG). Keine Nutzerdaten an Partner ohne Einwilligung (DSGVO).

**4.5 Nicht umsetzen (bewusst):** Payment-Provision via Stripe Connect und Veranstalter-Modul → Phase 5+; Lifetime-Deal nur ggf. als manuelle Launch-Aktion.

**Abnahme Phase 4:** Neuer User landet auf Free (kein Trial-Countdown); Limits greifen serverseitig (403 mit klarem Fehlercode); Credit-Kauf + Verbrauch funktioniert Ende-zu-Ende gegen Stripe-Testmode; Jahresexport hinter Einmalkauf; alle Abo-Alt-User-Zustände (active/cancelled) sauber migriert.

### Phase 5 (separat, nach Traktion) — Veranstalter-Modul (B2B2C)

Nur skizziert, nicht Teil dieses Auftrags: eigene Rolle „Veranstalter", Markt-Ausschreibungen, Standbewerbungen der Händler, Vergabe + Abrechnung; Erlös als flache Pro-Stand-Gebühr, Wahlmodell „Veranstalter zahlt oder Händler zahlt" (Marketspread-Logik). Erst bauen, wenn Kern-Traktion da ist (Benchmarks unten).

---

## 5. Querschnitt (in allen Phasen mitführen)

- **Tests:** Source-Grep-Tests durch echte ersetzen; Route-Handler-Integrationstests gegen Test-Postgres (z. B. PGlite/Testcontainer); Zod-Schemas aus den Routen **exportieren und in Tests importieren** statt duplizieren; kritische Pfade: Cents-Arithmetik, EÜR-Bucketing, Rechnungs-Immutabilität, Offline-Sync-Dedup, Limit-Enforcement.
- **Refactoring bei Gelegenheit:** Invoice-/GuV-HTML-Duplikate → gemeinsames Template-Modul (Phase 2 erledigt das); `deleteAllUserData`-Duplikat zwischen storage.ts und migrate-Route auflösen; Riesen-Client-Components (settings 642 Z., orders/[id] 452 Z.) in Teilkomponenten schneiden; i18n-Inline-Ternaries in `t`-Objekt überführen.
- **Konventionen:** TypeScript strict ohne `any`; Fehlermeldungen ohne Interna; `console.error` nur für echte Fehler; Query-Keys user-scoped; `queryClient.clear()` bei signOut/Löschung (existiert, beibehalten).

## 6. Erfolgs-Benchmarks (aus den Strategiedokumenten, quartalsweise prüfen)

- Free→Paid-Conversion ≥ 2 % (darunter: Pivot Richtung B2B2C/Provisionsmodell prüfen)
- ARPU ≥ 8 €/Monat über zahlende Nutzer
- Referral-Erlöse: erste Provisionen im ersten Quartal nach Aktivierung; < 500 € in 3 Monaten → Platzierung/UX überarbeiten
- Nach Veranstalter-Modul-Launch: ≥ 5 zahlende Veranstalter in 6 Monaten, Ziel > 20 für > 30 T€ ARR
