# Vendora – Fortschritt & Handoff

> **Lebendes Status-/Übergabedokument.** Die vollständige Spezifikation aller Phasen steht in
> [`docs/REBUILD-PLAN.md`](./REBUILD-PLAN.md). Diese Datei sagt nur: **was ist erledigt, was kommt
> als Nächstes, und wie man weiterarbeitet.**
>
> Stand: 2026-07-19 · Branch: `migrate/neon-betterauth`

---

## So geht es weiter (Quickstart für die nächste Session)

1. **Branch:** `migrate/neon-betterauth` (Basis der Rebuild-Arbeit, offen als PR #10 → `master`).
2. **Nächste offene Phase:** **Phase 5 – Veranstalter-Modul (B2B2C), nur skizziert** – erst bei Kern-Traktion. (Phasen 0–4 sind abgeschlossen.)
3. **Arbeitsweise (verbindlich, wie bisher):**
   - Phasen **in Reihenfolge**, jede Sub-Aufgabe (z. B. 2.1, 2.2 …) einzeln umsetzen.
   - Nach **jeder** Änderung: `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`. Erst wenn alle vier grün sind, committen.
   - **Ein Commit je Sub-Schritt** mit klarer Message (`Phase 2.1: …`).
   - Jede **Schemaänderung** → `npm run db:generate`, erzeugte Migration in `drizzle/` mitcommitten (Datenmigrationen ggf. per Hand ins SQL ergänzen, wie bei 0004).
   - Security-Regeln aus `CLAUDE.md` gelten ausnahmslos (Auth + Ownership, Zod, keine Secrets im Client, Stripe fail-closed, Transaktionen).
4. **Vor dem ersten Live-Test:** Die DB-Migrationen müssen angewendet sein (siehe „Offene operative Punkte" unten).

## Verifikation (alle vier grün vor jedem Commit)

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test
npm run build
```

---

## Phasen-Status

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Fundament & Pflichtreparaturen | ✅ erledigt |
| 1 | EÜR & Steuer | ✅ erledigt |
| 2 | Aufträge & Rechnungen (GoBD) | ✅ erledigt (2.1–2.5) |
| 3 | Marktmodus (Offline-PWA) | ✅ erledigt (3.1–3.4) |
| 4 | Monetarisierung | ✅ erledigt (Modell geändert, s. u.) |
| **5** | **Veranstalter-Modul (B2B2C)** | ⬜ **nur skizziert ← NÄCHSTE** |

### ✅ Phase 0 – erledigt

| Schritt | Commit |
|---|---|
| 0.1 Datenschutz: reale Auftragsverarbeiter (Supabase raus) | `5291044` |
| 0.2/0.3 Geld → Integer-Cents + echte Datums-/Zeitstempeltypen | `fa4bd87` |
| 0.4 Versionierte Drizzle-Migrationen (`drizzle/`) | `23abdb4` |
| 0.5 Härtung (Webhook-Dedup, Env-Validierung, `server-only`, Pagination, CI) | `6a31f8f` |
| 0.6 Doku korrigiert + Leichen entfernt (`app_settings`, `api/invoice-number`) | `baf70f3` |

### ✅ Phase 1 – erledigt

| Schritt | Commit |
|---|---|
| 1.1 Zahlungsdaten (`orders.paidAt`/`paymentMethod`, Zuflussprinzip) | `578ae7e` |
| 1.2/1.3 Einheitliches Ausgabenmodell (GuV-Bug-Fix) + EÜR-Kategorien | `fdb9690` |
| 1.4 Kleinunternehmer-Flag (§ 19 UStG) | `d48f0c1` |
| 1.5 EÜR-Ansicht `/steuer` + CSV/PDF-Export + Dashboard-Charts | `09d5b74` |

### ✅ Phase 3 – erledigt

Vollständige Spec + Abnahmekriterien: `docs/REBUILD-PLAN.md` → „Phase 3". Vorab wurde der alte Branch `claude/pwa-offline-marktmodus-of3xb2` gesichtet — er stammt aus der Supabase-Lineage und ist nicht direkt übernehmbar; die Konzepte (minimaler SW, Offline-Queue, Batch-Route mit clientId-Dedup) wurden neu und sauber umgesetzt.

| Schritt | Commit |
|---|---|
| 3.1 PWA-Basis (`app/manifest.ts`, Icons, handgeschriebener `public/sw.js`, SW-Registrierung, Headers, offline.html) | `8a1107a` |
| 3.2 Offline-Verkaufserfassung (IndexedDB-Queue + `useOfflineSales`, Batch-Route `/sales/batch`, `client_id`-Dedup, Migration 0009) | `0f51a6c` |
| 3.3 Kassen-UX Vollbild-POS `/markets/[id]/kasse` (Bar/Karte, Menge, Undo) + Tagesabschluss (`marketDay.ts`) + TSE-Hinweis/SumUp; `payment_method`, Migration 0010 | `a2b872c` |
| 3.4 Marktkalender (Frist + Status applied/confirmed, Migration 0011) + Jahresvergleich (`marketCalendar.ts`) | `8396ef8` |

**Entscheidungen (dokumentiert):** (a) **handgeschriebener Service Worker statt serwist** — serwist braucht laut Next-Guide webpack, Next 16 fährt Turbopack. (b) **Idempotenz über separate `client_id`-Spalte** statt Client-gesetztem PK (Server generiert die echte PK, Dedup per Unique-Index `(user_id, client_id)`). (c) **Kalender als Listen-/Gruppenansicht mit Fristen** statt Monats-Grid.

**Offene Abnahme (manuell, gegen ein deploytes/migriertes Env):** Flugmodus-Test (Markt öffnen → 5 Verkäufe offline → online → alle exakt einmal) und Lighthouse-PWA-Installierbarkeit sind Laufzeit-Checks, die eine laufende Instanz mit angewandten Migrationen brauchen (siehe operative Punkte). Die deterministische Grundlage ist durch die vier grünen Checks + Unit-Tests (Batch-Idempotenz, Tagesabschluss, Kalender/Jahresvergleich) abgedeckt.

### ✅ Phase 4 – erledigt (Monetarisierungsmodell **geändert**)

> **Modellwechsel ggü. `REBUILD-PLAN.md` (Entscheidung Inhaber:in):** Statt Freemium mit Feature-Kontingenten + Pay-per-Use/Credits gilt: **ein Preis – Vendora Pro = 19,90 €/Monat für alles**, mit **42-Tage-Trial** (Vollzugriff) für neue Nutzer. Nach Trial ohne Zahlung ist das Konto **Free = Nur-Lese**: ansehen + **bestehende Belege (Rechnungs-PDFs) und DSGVO-Datenexport herunterladen** immer möglich; **nichts Neues anlegen** – dazu zählt auch die **GuV/Jahresübersicht (EÜR-Export)**. **Gestrichen:** Credits/Pay-per-Use und der Jahresexport-Einmalkauf.

| Schritt | Commit |
|---|---|
| 4.1 Plan-Infrastruktur: `users.plan` (free/pro, Migration 0012 + Datenmigration), `getEffectivePlan` (Auto-Downgrade bei Ablauf), Webhook/Provisioning/Admin/Subscription-API plan-basiert | `21cd656` |
| 4.2 Read-only-für-Free-Modell: `requireWriteAccess` (403 `PRO_REQUIRED`) auf allen Create-Endpoints; `STRIPE_PRICE_ID` → Env (19,90 €); persistenter Upgrade-Banner + `useCanCreate`-Gating der Create-UIs | `646183d` |
| 4.4 Referral-Slots: SumUp im Marktmodus (3.3) + generische, env-konfigurierbare `ReferralCard` (Betriebshaftpflicht in Settings), als „Anzeige" (UWG), keine Nutzerdaten an Partner | `20166c6` |
| 4.5 Trial (42 Tage) reaktiviert: `Plan = free\|trial\|pro`, `canCreate = pro\|\|trial`, provisioning setzt `trialEndsAt` (kein Schema-Change – Spalte existierte). GuV/EÜR-Export wieder `requireWriteAccess`-gegatet; **Rechnungs-PDF + DSGVO-Export bleiben offen**. Banner zeigt Trial-Restlaufzeit; `/steuer`-Export-Buttons für Free gegatet | (dieser Commit) |

**Abnahme:** neuer User = Trial (42 Tage, Vollzugriff) ✅; nach Trial Free/Nur-Lese ✅; Create + GuV-Export serverseitig 403 `PRO_REQUIRED` ✅; Rechnungs-PDF/DSGVO-Export für Free frei ✅; Alt-User-Migration (aktive Abos → pro) ✅. **Operativ offen:** Stripe-Pro-Produkt (19,90 €) anlegen + `STRIPE_PRICE_ID` setzen; End-to-End-Kauf im Stripe-Testmode verifizieren.

---

## Offene operative Punkte (kein Phasen-Inhalt, aber wichtig)

Diese sind **nicht im Code zu lösen**, sondern beim Betrieb/Deploy — bewusst nicht automatisch ausgeführt:

1. **DB-Migrationen anwenden (blockierend für Live-Test):** `npm run db:migrate` (0000–0012) gegen eine passende, am besten **frische** Neon-DB. Die Live-DB hat noch das alte `db:push`-Schema. Neu seit Phase 3/4: `market_sales.client_id` (0009), `market_sales.payment_method` (0010), `market_events.application_deadline` + Status (0011), `users.plan` (0012, inkl. Datenmigration aktive Abos → pro). **Schritt-für-Schritt-Anleitung: [`docs/DB-MIGRATION.md`](./DB-MIGRATION.md).**
2. **Stripe-Pro-Produkt anlegen (blockierend für Billing):** In Stripe ein Produkt mit **monatlichem Preis 19,90 €** anlegen und dessen `price_…`-ID als `STRIPE_PRICE_ID` (Env/Vercel) setzen. Ohne diese Variable liefert der Checkout 500. `src/lib/server/stripe.ts` liest sie jetzt aus der Env (kein Hardcode mehr).
3. **Webhook `current_period_end`** hat einen +30-Tage-Fallback (Stripe-API-Version-Unsicherheit) → bei Live-Billing gegen Stripe-Testmode verifizieren.
4. **CI `Security & Quality Check` rot:** `npm audit --audit-level=high` scheitert an einer Next.js-High-Advisory ohne stabilen Fix (+ dev-only vite). Nicht von dieser Arbeit verursacht; separat entscheiden (Allowlist/Gate-Anpassung), nicht durch Downgrade.
5. **PR #10 → `master` mergen** + Vercel-Env final setzen, sobald die DB-Migration steht.

---

## Abgeschlossen: Phase 2 — Aufträge & Rechnungen (GoBD)

> Historie / Referenz. Vollständige Spec + Abnahmekriterien: `docs/REBUILD-PLAN.md` → „Phase 2".

- **2.1 `invoices`-Tabelle** ✅ **erledigt** (`f640c78`) – unveränderlicher Snapshot bei Rechnungserstellung (Nummer, Datum, Absender/Empfänger, Positionen als jsonb, Beträge in **Cents**, Steuerhinweise, `orderId` set-null, `status` issued/cancelled, `pdfUrl` (2.2)). Kein UPDATE auf ausgestellte Rechnungen — Korrektur nur per **Stornorechnung** (negiert, neue Nummer, Referenz). Reines Modul `src/lib/invoice.ts` (Builder, 13 Tests) + Storage `issueInvoice/cancelInvoice/getInvoices/getInvoice` + API `/api/invoices(+/[id](+/cancel))`. Migration `drizzle/0006`. **Noch NICHT gemacht (kommt in 2.2):** Entkopplung Order-Erstellung von der Nummernvergabe, UI-Button „Rechnung ausstellen", Ablösung des Client-HTML-Prints.
- **2.2 Server-PDF** ✅ **erledigt** (`c006055` 2.2a, `24bd360` 2.2b) – **Entscheidung: PDF on-demand aus dem immutablen Snapshot erzeugen** (kein Objekt-Storage, kein Vendor, `pdfUrl` bleibt null, byte-identisch reproduzierbar). Gemeinsames pdf-lib-Modul `src/lib/server/pdf.ts` (A4-Canvas, `sanitizeWinAnsi` für freien Nutzertext) + `invoicePdf.ts`; `euerExport` darauf umgestellt. Endpoint `GET /api/invoices/[id]/pdf`. UI: Order-Detailseite stellt Rechnungen aus/storniert + PDF-Download (Client-HTML-Print entfernt). **Nummern-Entkopplung:** `createOrder` vergibt keine Rechnungsnummer mehr — der Counter zählt nur ausgestellte Rechnungen.
- **2.3 Aufbewahrung vs. DSGVO** ✅ **erledigt** (`3c367c4`) – Account-Löschung **archiviert Rechnungen statt sie zu löschen**: `invoices.userId` nullable + FK `SET NULL`, neue Spalten `archivedAt`/`retentionUntil`; `archiveUserInvoices` entkoppelt `userId→null` + stempelt Frist (31.12. Ausstellungsjahr+10, §147 Abs.3 AO), Snapshot unverändert; `invoices` raus aus `deleteAllUserData`; aktive Abfragen filtern `archivedAt IS NULL`; `api/export` (Art. 20) enthält jetzt Rechnungen. Migration `0007`. Datenschutz-Passus deckt das bereits ab (Phase 0.1). **Offen/optional:** Cron-Löschung nach Ablauf `retentionUntil`; Rechnungen in Backup/Restore (`api/migrate` fasst `invoices` bewusst nicht an).
- **2.4 Kundenstamm** ✅ **erledigt** (`aff160b`) – `customers`-Tabelle (user-scoped) + `orders.customerId` (FK SET NULL); `getCustomers`/`upsertCustomerFromOrder` (Exact-Match-Dedup) in create/updateOrder; `api/customers` liefert die echte Tabelle; Datalist-Autocomplete + Auto-Fill in Neu-/Edit-Formular; `customers` in `deleteAllUserData` + migrate-Reset. Migration `drizzle/0008` inkl. Datenmigration (distinct-Kunden aus Orders seeden + verknüpfen).
- **2.5 E-Rechnung (nur vorbereiten)** ✅ **erledigt** (Doku) – Datenmodell ist ZUGFeRD/XRechnung-erweiterbar (strukturierte Cent-Beträge, Leistungsdatum, strukturierte Parteien). Readiness-Assessment + Ausbauplan (Lücken: USt je Position, strukturierte Steuer-IDs, Leitweg-ID, Währung, Einheit) in **[`docs/E-RECHNUNG.md`](./E-RECHNUNG.md)**. Kein Code (KU von Ausstellungspflicht befreit).
- **Abnahme:** ✅ Rechnung → PDF identisch reproduzierbar (on-demand, deterministisch); ✅ Auftrag ändern → Rechnung unverändert (immutabler Snapshot, kein `updateInvoice`); ✅ Storno-Flow; ✅ Account-Löschung erhält Rechnungsarchiv. **Offen (Querschnitt):** DB-gestützte **Integrationstests** für Rechnungs-Immutabilität — verschoben, bis eine Test-Postgres-Harness (PGlite/Testcontainer) existiert; aktuell durch Unit-Tests der reinen Builder + strukturelle Immutabilität (kein UPDATE-Pfad) abgedeckt.

---

## Danach (Kurzfassung, Details im Plan)

- **Phase 5 – Veranstalter-Modul (B2B2C, ← NÄCHSTE, nur skizziert):** eigene Rolle „Veranstalter", Markt-Ausschreibungen, Standbewerbungen, Vergabe + Abrechnung (Pro-Stand-Gebühr). Erst bei Kern-Traktion bauen (Benchmarks in `REBUILD-PLAN.md` §6).

## Querschnitt (in jeder Phase mitführen)

- Zod-Schemas aus Routen **exportieren + in Tests importieren** statt duplizieren (`validation.test.ts` dupliziert noch).
- `deleteAllUserData`-Duplikat (storage.ts ↔ migrate-Route) auflösen; große Client-Components schneiden; i18n-Inline-Ternaries ins `t`-Objekt.
- Integrationstests gegen Test-Postgres (PGlite/Testcontainer) für kritische Pfade (Rechnungs-Immutabilität, Offline-Sync-Dedup, Limit-Enforcement).
