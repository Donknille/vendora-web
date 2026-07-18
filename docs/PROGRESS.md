# Vendora – Fortschritt & Handoff

> **Lebendes Status-/Übergabedokument.** Die vollständige Spezifikation aller Phasen steht in
> [`docs/REBUILD-PLAN.md`](./REBUILD-PLAN.md). Diese Datei sagt nur: **was ist erledigt, was kommt
> als Nächstes, und wie man weiterarbeitet.**
>
> Stand: 2026-07-18 · Branch: `migrate/neon-betterauth`

---

## So geht es weiter (Quickstart für die nächste Session)

1. **Branch:** `migrate/neon-betterauth` (Basis der Rebuild-Arbeit, offen als PR #10 → `master`).
2. **Nächste offene Phase:** **Phase 2 – Aufträge & Rechnungen (GoBD).** Spec: `docs/REBUILD-PLAN.md`, Abschnitt „Phase 2".
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
| **2** | **Aufträge & Rechnungen (GoBD)** | ⬜ **offen ← NÄCHSTE** |
| 3 | Marktmodus (Offline-PWA) | ⬜ offen |
| 4 | Monetarisierung (ohne Abo-Zwang) | ⬜ offen |
| 5 | Veranstalter-Modul (B2B2C) | ⬜ nur skizziert |

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

---

## Offene operative Punkte (kein Phasen-Inhalt, aber wichtig)

Diese sind **nicht im Code zu lösen**, sondern beim Betrieb/Deploy — bewusst nicht automatisch ausgeführt:

1. **DB-Migrationen anwenden (blockierend für Live-Test):** `npm run db:migrate` (0000–0005) gegen eine passende, am besten **frische** Neon-DB. Die Live-DB hat noch das alte `db:push`-Schema (numeric/text, ohne `paidAt`, `expenses.marketId/source`, EÜR-Kategorien, `isSmallBusiness`, `webhook_events`). **Schritt-für-Schritt-Anleitung: [`docs/DB-MIGRATION.md`](./DB-MIGRATION.md).**
2. **`STRIPE_PRICE_ID`** noch hartkodiert in `src/lib/server/stripe.ts` → wird in **Phase 4** auf Env/Config umgestellt.
3. **Webhook `current_period_end`** hat einen +30-Tage-Fallback (Stripe-API-Version-Unsicherheit) → bei Live-Billing gegen Stripe-Testmode verifizieren.
4. **CI `Security & Quality Check` rot:** `npm audit --audit-level=high` scheitert an einer Next.js-High-Advisory ohne stabilen Fix (+ dev-only vite). Nicht von dieser Arbeit verursacht; separat entscheiden (Allowlist/Gate-Anpassung), nicht durch Downgrade.
5. **PR #10 → `master` mergen** + Vercel-Env final setzen, sobald die DB-Migration steht.

---

## Nächste Phase im Detail — Phase 2: Aufträge & Rechnungen (GoBD)

> Vollständige Spec + Abnahmekriterien: `docs/REBUILD-PLAN.md` → „Phase 2".

- **2.1 `invoices`-Tabelle** – unveränderlicher Snapshot bei Rechnungserstellung (Nummer, Datum, Absender/Empfänger, Positionen als jsonb, Beträge in **Cents**, Steuerhinweise, `orderId`, `status` issued/cancelled, `pdfUrl`). Kein UPDATE auf ausgestellte Rechnungen — Korrektur nur per **Stornorechnung** (neue Nummer, negativer Betrag, Referenz) + Neuausstellung.
- **2.2 Server-PDF** – serverseitige PDF-Erzeugung (pdf-lib ist schon drin, s. `src/lib/server/euerExport.ts`), Ablage in Objekt-Storage (Vercel Blob **oder** Neon Object Storage — eines wählen + dokumentieren), `pdfUrl` speichern. **Gemeinsames Template-Modul** für Rechnung **und** EÜR-PDF (Duplikate aus `orders/[id]` und Dashboard ablösen).
- **2.3 Aufbewahrung vs. DSGVO** – Account-Löschung anonymisiert + löscht Nicht-Beleg-Daten, **archiviert Rechnungen** (userId-Entkopplung, Aufbewahrung +10 Jahre). Datenschutz-Passus existiert bereits (Phase 0.1). `api/export` um Rechnungen erweitern.
- **2.4 Kundenstamm** – `customers`-Tabelle (user-scoped), Autocomplete im Auftragsformular, tote Route `api/customers` + `useCustomers()` anschließen, distinct-Kunden aus Bestellungen migrieren. Orders optional `customerId` + Adress-Snapshot behalten.
- **2.5 E-Rechnung (nur vorbereiten)** – Datenmodell ZUGFeRD/XRechnung-fähig halten (strukturierte Beträge, Leistungsdatum vorhanden).
- **Abnahme:** Rechnung → PDF gespeichert + identisch reproduzierbar; Auftrag ändern → Rechnung unverändert; Storno-Flow; Account-Löschung erhält Rechnungsarchiv; Integrationstests für Rechnungs-Immutabilität.

---

## Danach (Kurzfassung, Details im Plan)

- **Phase 3 – Marktmodus (Offline-PWA):** PWA-Basis/Service Worker, Offline-Sale-Queue (IndexedDB, idempotenter Sync via Client-UUID), Kassen-UX + Tagesabschluss (bar/Karte), Marktkalender + Jahresvergleich. Vorab Branch `claude/pwa-offline-marktmodus-of3xb2` sichten.
- **Phase 4 – Monetarisierung:** Free-Basis statt Trial (serverseitige Feature-Limits, `plan`-Feld), Credits/Pay-per-Use, EÜR-Jahresexport als Einmalkauf, Referral-Slots. `STRIPE_PRICE_ID` → Config.
- **Phase 5 – Veranstalter-Modul (B2B2C):** erst bei Kern-Traktion.

## Querschnitt (in jeder Phase mitführen)

- Zod-Schemas aus Routen **exportieren + in Tests importieren** statt duplizieren (`validation.test.ts` dupliziert noch).
- `deleteAllUserData`-Duplikat (storage.ts ↔ migrate-Route) auflösen; große Client-Components schneiden; i18n-Inline-Ternaries ins `t`-Objekt.
- Integrationstests gegen Test-Postgres (PGlite/Testcontainer) für kritische Pfade (Rechnungs-Immutabilität, Offline-Sync-Dedup, Limit-Enforcement).
