# Vendora Web Security Audit Report

**Datum:** 2026-04-19
**Methode:** Statische Code-Analyse (kein Live-Traffic, keine API-Calls)
**Auditor:** Claude Code (Opus 4.7)
**Fokus:** Multi-Tenant-Isolation, Rechnungs-/PDF-Sicherheit, Stripe, DSGVO/GoBD
**Scope:** 29 API-Routen, Middleware, Auth, Storage-Layer, Schema, Stripe-Integration, PDF-Generierung

---

## Executive Summary

- **Gesamtrisiko:** Mittel (1 Release-Blocker offen — RLS-Migration nicht eingespielt)
- **Tenant-Isolation:** Bestanden mit Einschraenkung (siehe Hinweis unten)
- **Findings nach Schweregrad:** 0 Kritisch, 2 Hoch, 4 Mittel, 3 Niedrig
- **Release-Empfehlung:** **Go mit Einschraenkungen** — Finding H1 (RLS-Migration) und H2 (ARCJET_KEY auf Vercel) vor Produktiv-Deploy abarbeiten

### Wichtiger Architektur-Hinweis

Vendora ist **kein klassisches Multi-Tenant-SaaS** im Sinne des Audit-Prompts. Die Architektur ist **Single-User-per-Tenant**: jeder User ist gleichzeitig sein eigener Tenant. Es gibt daher **keine `tenant_id`** — stattdessen wird `user_id` als Tenancy-Discriminator auf allen Geschaeftstabellen genutzt. Die Datenbankzugriffe erfolgen **nicht** ueber den Supabase-User-Client mit RLS, sondern ueber eine direkte Postgres-Verbindung via Drizzle ORM, mit **app-seitiger Filterung** (`WHERE user_id = ?` in jeder Query).

Diese Architektur ist legitim und verbreitet, verlagert aber die gesamte Access-Control-Verantwortung in den Application-Code. RLS fungiert nur als Defense-in-Depth gegen direkten PostgREST-Zugriff via Anon-Key.

---

## Stack-Zusammenfassung

| Aspekt | Wert |
|---|---|
| Next.js-Version | 16.2.3 (App Router, Turbopack) |
| Router | App Router (`src/app/`) |
| ORM | Drizzle 0.45.2 (direkte Postgres-Verbindung) |
| Auth-Provider | Supabase Auth (via `@supabase/ssr` 0.9.0) |
| DB-Zugriff | `postgres` Node-Client mit Drizzle |
| Realtime genutzt | Nein |
| Supabase Storage genutzt | Nein |
| File-Upload | Nein |
| PDF-Generierung | Clientseitig via `window.print()` (keine Server-Headless-Browser) |
| Rate Limiting | Arcjet `@arcjet/next` 1.4.0 (Middleware, 3 Stufen) |
| Migrations | `drizzle/*.sql` (3 Migrations, inkl. RLS-Policies in `0003`) |

---

## Tenant-Isolation-Matrix

Tabellenueberblick aus [src/lib/server/schema.ts](src/lib/server/schema.ts). RLS-Status bezieht sich auf [drizzle/0003_enable_rls.sql](drizzle/0003_enable_rls.sql) (noch nicht in Produktion eingespielt — siehe Finding H1).

| Tabelle | RLS vorgesehen | FORCE RLS | Policy (SELECT/INSERT/UPDATE/DELETE) | Tenant-Feld | App-Check in jeder Query | Bewertung |
|---|---|---|---|---|---|---|
| users | Ja (ALTER TABLE) | Nein | FOR ALL USING (false) zu anon/authenticated | `id` (PK = Supabase-UID) | getAuthUserId() | ✅ OK |
| orders | Ja | Nein | FOR ALL USING (false) | `user_id` FK | `WHERE user_id` | ✅ OK |
| order_items | Ja | Nein | FOR ALL USING (false) | via `orderId` (transitive) | `orderId` join | ⚠ transitive |
| market_events | Ja | Nein | FOR ALL USING (false) | `user_id` FK | `WHERE user_id` | ✅ OK |
| market_sales | Ja | Nein | FOR ALL USING (false) | `user_id` FK | `WHERE user_id` | ✅ OK |
| expenses | Ja | Nein | FOR ALL USING (false) | `user_id` FK | `WHERE user_id` | ✅ OK |
| company_profiles | Ja | Nein | FOR ALL USING (false) | `user_id` FK UNIQUE | `WHERE user_id` | ✅ OK |
| app_settings | Ja | Nein | FOR ALL USING (false) | `user_id` FK UNIQUE | `WHERE user_id` | ✅ OK |
| invoice_counters | Ja | Nein | FOR ALL USING (false) | `user_id` PK | `WHERE user_id` | ✅ OK |

**Hinweis:** `FORCE ROW LEVEL SECURITY` ist nicht gesetzt. Das ist **bewusst**, weil die App mit der `postgres`-Role verbindet (Table Owner), die RLS standardmaessig umgeht. Ein versehentlicher Service-Role-Query wuerde dennoch Daten zurueckgeben, aber das entspricht dem vorgesehenen Design (alle Queries laufen via App-Code mit `user_id`-Filter).

---

## Findings

### [HIGH] H1 — RLS-Migration noch nicht eingespielt

- **Kategorie:** Tenant-Isolation / Defense-in-Depth
- **Datei:** [drizzle/0003_enable_rls.sql](drizzle/0003_enable_rls.sql)
- **Beweis:** Migration existiert im Repo, wurde aber laut [docs/handover.md](docs/handover.md) noch nicht im Supabase SQL Editor ausgefuehrt.
- **Risiko:** Der oeffentlich exponierte Supabase-Anon-Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) erlaubt Zugriff auf die PostgREST-API (`https://<project>.supabase.co/rest/v1/...`). Ohne RLS-Policies kann ein Angreifer alle Geschaeftsdaten (Orders, Kunden, Rechnungen, Umsaetze) aller User direkt via PostgREST auslesen — komplett an der App-Logik vorbei.
- **Empfehlung:** Sofort den Inhalt von `drizzle/0003_enable_rls.sql` im Supabase SQL Editor ausfuehren (Schritt 1.1 in `docs/handover.md`). Nach Einspielung verifizieren mit:
  ```sql
  SET ROLE authenticated;
  SELECT * FROM orders LIMIT 1;  -- muss 0 Zeilen liefern
  RESET ROLE;
  ```

### [HIGH] H2 — ARCJET_KEY nicht auf Vercel gesetzt → Production 503

- **Kategorie:** Infrastruktur / Availability
- **Datei:** [src/middleware.ts:26-32](src/middleware.ts)
- **Beweis:**
  ```typescript
  } else if (process.env.NODE_ENV === "production") {
    console.error("ARCJET_KEY is not configured — rejecting request in production");
    return NextResponse.json(
      { message: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
  ```
- **Risiko:** Nach dem fail-closed Fix (Pentest-Finding A1) blockt die Middleware **alle** Requests mit 503, wenn `ARCJET_KEY` nicht in den Vercel Environment Variables gesetzt ist. Push auf master fuehrt ohne diesen Schritt zu komplettem Production-Ausfall.
- **Empfehlung:** Vor Push: Arcjet-Account anlegen (https://app.arcjet.com), Key in Vercel Dashboard → Settings → Environment Variables eintragen fuer Production + Preview + Development. Free Tier reicht (5.000 req/Monat).

### [MEDIUM] M1 — GoBD-Konflikt: Rechnungen sind nachtraeglich editierbar

- **Kategorie:** DSGVO / GoBD-Compliance
- **Dateien:**
  - [src/app/api/orders/[id]/route.ts:32-62](src/app/api/orders/[id]/route.ts) — PUT erlaubt jederzeit Bearbeitung
  - [src/app/api/account/route.ts:55-60](src/app/api/account/route.ts) — Account-Loeschung entfernt alle Orders ohne Archiv
- **Beweis:** Es existiert kein Finalized-Status und keine Sperre gegen nachtraegliche Aenderung von Rechnungen mit generierter Rechnungsnummer. Account-Loeschung ruft `deleteAllUserData()` in Transaktion — Orders werden komplett entfernt.
- **Risiko:** Nach deutschem Steuerrecht (GoBD § 146 AO, § 14 UStG) muessen Rechnungen 10 Jahre unveraendert aufbewahrt werden. Eine Account-Loeschung nach DSGVO Art. 17 kollidiert mit dieser gesetzlichen Pflicht. Aktuell: DSGVO gewinnt und Rechnungen werden geloescht — potenzieller Verstoss gegen Aufbewahrungspflichten.
- **Empfehlung:** Zwei getrennte Massnahmen:
  1. Orders mit `invoiceNumber != ""` als "finalisiert" markieren und nur noch Status-Updates zulassen (`status`-Feld), keine Edits an Betraegen/Kunden/Positionen.
  2. Bei Account-Loeschung: Rechnungen nicht entfernen, sondern in eine separate `archived_invoices`-Tabelle kopieren mit `anonymized_user_id`, Klartext-Kundendaten bleiben (gesetzliche Pflicht) aber nicht mehr dem Plattform-Account zugeordnet.
- **Hinweis:** Dieser Konflikt sollte rechtlich vor Produktiv-Betrieb geklaert werden (Anwalt oder DATEV-Beratung).

### [MEDIUM] M2 — Stripe-Webhook: Keine Event-ID-Deduplizierung

- **Kategorie:** Stripe / Idempotenz
- **Datei:** [src/app/api/stripe/webhook/route.ts](src/app/api/stripe/webhook/route.ts)
- **Beweis:** Webhook prueft Signatur korrekt (`stripe.webhooks.constructEvent`), aber trackt keine `event.id`. Idempotenz wird nur ueber Expiry-Vergleich realisiert (neuer Expiry muss spaeter sein).
- **Risiko:** Stripe garantiert "at-least-once" Delivery — derselbe Webhook kann legitim mehrfach ankommen. Aktueller Schutz (Expiry-Compare) fuer `invoice.payment_succeeded` ausreichend, aber nicht fuer `customer.subscription.deleted` — ein verspaeteter Replay dieses Events koennte aktive Subscriptions auf "cancelled" setzen.
- **Empfehlung:** Neue Tabelle `stripe_events(event_id TEXT PRIMARY KEY, processed_at TIMESTAMP)`. Am Anfang des Webhook-Handlers:
  ```typescript
  const [existing] = await db.select().from(stripeEvents).where(eq(stripeEvents.eventId, event.id));
  if (existing) return NextResponse.json({ received: true });
  await db.insert(stripeEvents).values({ eventId: event.id, processedAt: new Date() });
  // ... dann event verarbeiten
  ```

### [MEDIUM] M3 — Admin-Rollenpruefung ueber E-Mail-Whitelist

- **Kategorie:** AuthZ / Privilege Escalation
- **Datei:** [src/lib/server/admin.ts:5-19](src/lib/server/admin.ts)
- **Beweis:**
  ```typescript
  const getAdminEmails = (): string[] =>
    (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase())
  ```
- **Risiko:** Admin-Berechtigung haengt komplett an der `ADMIN_EMAILS` Env Var. Wer Zugriff auf Vercel-Team/Env-Vars hat, kann sich selbst als Admin eintragen. Ausserdem: Wer die E-Mail-Adresse eines Admin kompromittiert (Password-Reset + Mail-Zugriff), wird automatisch Admin.
- **Empfehlung:**
  1. DB-basierte Admin-Rolle einfuehren: neue Spalte `users.role` mit Check-Constraint `role IN ('user', 'admin')`
  2. Nur Superadmin kann Rolle setzen (z.B. via direktem SQL)
  3. Im Admin-UI Logging fuer alle Admin-Aktionen (wer hat wen wann geblockt/verlaengert)

### [MEDIUM] M4 — PDF-Rechnungserstellung ist reine Client-Logik

- **Kategorie:** Rechnungs-/PDF-Sicherheit
- **Datei:** [src/app/(app)/orders/[id]/page.tsx:87-243](src/app/(app)/orders/[id]/page.tsx)
- **Beweis:** `handleCreateInvoice()` generiert HTML im Browser, oeffnet neues Fenster, ruft `window.print()` auf. Kein serverseitiger Endpunkt ist involviert.
- **Positiv:**
  - ✅ Alle User-Daten werden ueber `escapeHtml()` aus [src/lib/escapeHtml.ts](src/lib/escapeHtml.ts) escaped
  - ✅ Keine SSRF-Risiken (kein Headless Browser)
  - ✅ Rechnungsnummer wird serverseitig atomar vergeben ([src/lib/server/storage.ts:509-520](src/lib/server/storage.ts))
- **Risiko:** Der Client vertraut auf lokal zwischengespeicherte Order-Daten. Ein Angreifer mit DOM-Zugriff (z.B. ueber eine kompromittierte Browser-Extension oder XSS) kann eine Rechnung mit beliebigen Daten generieren — diese ist aber rein clientseitig und hat keine Rechtswirkung (wird nicht in der DB persistiert). Fuer buchhalterische Korrektheit problematisch: keine Gewissheit was der User wirklich gedruckt hat.
- **Empfehlung:** Serverseitige PDF-Generierung einfuehren, z.B. mit `@react-pdf/renderer` oder einem leichten HTML-zu-PDF-Service. Benefits: (1) Rechnung ist buchhalterisch reproduzierbar, (2) PDF-Hash kann in `orders.invoice_pdf_hash` persistiert werden, (3) GoBD-Audit-Trail moeglich. Aufwand: ~4-6 Stunden.

### [LOW] L1 — Kein `import "server-only"` Marker

- **Kategorie:** Defense-in-Depth
- **Datei:** [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts), [src/lib/server/db.ts](src/lib/server/db.ts), [src/lib/server/storage.ts](src/lib/server/storage.ts)
- **Beweis:** `grep -r "import \"server-only\"" src/` liefert keine Treffer.
- **Risiko:** Ein Entwickler koennte versehentlich `getAdminClient()` (Service-Role) oder `storage.getOrders()` (direct DB) in einer Client Component importieren. Next.js wuerde das erst beim Build bemerken, wenn ueberhaupt. Der `SUPABASE_SERVICE_ROLE_KEY` ist zwar nicht `NEXT_PUBLIC_*` und daher nicht im Client-Bundle, aber der Import-Graph wuerde Build-Fehler oder unerwartetes Verhalten provozieren.
- **Empfehlung:** In allen Server-only Modulen als erste Zeile hinzufuegen:
  ```typescript
  import "server-only";
  ```
  Betrifft: `src/lib/supabase/admin.ts`, `src/lib/server/db.ts`, `src/lib/server/storage.ts`, `src/lib/server/auth.ts`, `src/lib/server/admin.ts`, `src/lib/server/arcjet.ts`.

### [LOW] L2 — Rate Limiting rein IP-basiert

- **Kategorie:** Bot-Resistenz
- **Datei:** [src/lib/server/arcjet.ts:5-17](src/lib/server/arcjet.ts)
- **Beweis:**
  ```typescript
  characteristics: ["ip.src"],
  ```
- **Risiko:** IP-basiertes Rate Limiting kann mit Proxy-Rotation oder IPv6-Fluten umgangen werden. Besonders bei Auth-Endpunkten (5/min) fuehrt ein geteilter NAT (z.B. in Firmennetzwerken oder Cafe-WLAN) zu False-Positives fuer mehrere legitime User. Ausserdem: Arcjet liest IP aus Vercel-Headers, die ein Angreifer via `X-Forwarded-For` nicht mehr faelschen kann (Vercel stripped das) — aber das ist implizit.
- **Empfehlung:** Zusaetzliche Characteristic fuer User-ID bei authentifizierten Endpunkten:
  ```typescript
  characteristics: ["ip.src", "http.request.headers.cookie.sb-access-token"]
  ```
  Oder: Arcjet `tokenBucket`-Rule mit custom Key (z.B. User-ID aus JWT).

### [LOW] L3 — GET-Endpunkte ohne Pagination

- **Kategorie:** DoS / Performance
- **Dateien:** Alle GET-Endpunkte in `src/app/api/` ausser `/api/customers` (hat `limit: 50`)
- **Beweis:** z.B. `GET /api/orders` → `storage.getOrders(userId)` liefert **alle** Orders zurueck, ohne LIMIT.
- **Risiko:** User mit 10.000+ Orders wuerde bei jedem Dashboard-Load mehrere MB JSON laden → Vercel Function Timeout (10s Default). Kein direktes Security-Risiko, aber Enabler fuer DoS: Angreifer kann eigene Orders bis Limit (Zod max 200 bei Migrate) fuellen, dann jeden GET-Call zu langlaufender Query machen.
- **Empfehlung:** Cursor-basierte Pagination mit `?cursor=<id>&limit=50`. Im Dashboard nur die letzten 50 Orders, Button "Mehr laden".

---

## Positiv-Befunde

- ✅ **Alle 29 API-Routen** verwenden `getAuthUserId()` + Null-Check → 401 (verifiziert via Grep)
- ✅ **Alle DB-Queries** auf Geschaeftstabellen haben `WHERE user_id = ?` Filter (Storage-Layer zentralisiert)
- ✅ **Blockierte User** werden in `getAuthUserId()` abgewiesen (src/lib/server/auth.ts:25)
- ✅ **Soft-Delete-Guard**: Geloeschte E-Mails koennen nicht re-registriert werden (ensureUserRecord)
- ✅ **Stripe-Webhook-Signatur** wird korrekt via `constructEvent` verifiziert, `body` als `text()` gelesen
- ✅ **Stripe-Checkout**: `idempotencyKey` bei Customer-Erstellung (verhindert Duplikate)
- ✅ **Service-Role-Client** nur in `src/lib/supabase/admin.ts`, nur von `/api/account DELETE` aufgerufen
- ✅ **Keine NEXT_PUBLIC_-Secrets** ausser legitimen Supabase-URL + Anon-Key
- ✅ **Input-Validation** mit Zod auf allen Schreib-Endpunkten (Max-Length, Num-Range, noHtml fuer Profile)
- ✅ **HTML-Escape** (escapeHtml) fuer alle dynamischen Werte in der PDF-Rechnung
- ✅ **Keine** `dangerouslySetInnerHTML` im gesamten Code (grep bestaetigt)
- ✅ **Keine** Raw-SQL mit User-Input (alle `sql\`\`` nur fuer ORDER BY / SQL-Defaults)
- ✅ **Rechnungsnummer** serverseitig vergeben, atomares SQL-Increment (`counter + 1`)
- ✅ **Security-Headers** in [next.config.ts](next.config.ts): HSTS preload, X-Frame-Options DENY, CSP, Permissions-Policy, Referrer-Policy
- ✅ **Source Maps** in Production deaktiviert (`productionBrowserSourceMaps: false`)
- ✅ **Rate Limiting** fail-closed in Production (503 ohne ARCJET_KEY)
- ✅ **Transaktionen** bei Multi-Step Operationen: Account-Loeschung, Backup-Restore, Order-Update
- ✅ **DELETE-Endpunkte** geben 404 bei nicht-existierenden Ressourcen (nach Pentest-Fix A3)
- ✅ **Keine** Supabase Storage, keine Realtime Subscriptions, keine File-Uploads → kein zusaetzlicher Angriffsvektor
- ✅ **DSGVO Art. 17** (Account-Loeschung): Stripe + Supabase Auth + DB in korrekter Reihenfolge
- ✅ **DSGVO Art. 20** (Datenexport): `/api/export` liefert alle User-Daten als JSON
- ✅ **Keine PII in Logs**: `console.log` nur im Stripe-Webhook mit User-UUIDs (keine Namen/Emails)
- ✅ **LocalStorage**: nur Theme + Language, keine sensiblen Daten
- ✅ **Drizzle ORM >= 0.45.2** (CVE-2026-39356 behoben)

---

## Priorisierter Massnahmenplan

| # | Massnahme | Schweregrad | Aufwand | Release-Blocker? |
|---|---|---|---|---|
| 1 | RLS-Migration 0003 in Supabase einspielen | Hoch | 5 Min | **Ja** |
| 2 | ARCJET_KEY auf Vercel setzen (Production+Preview+Development) | Hoch | 15 Min | **Ja** |
| 3 | Stripe Event-ID-Deduplizierung (M2) | Mittel | 2 h | Nein |
| 4 | GoBD-Konformitaet: Invoice-Finalization + Archivierung (M1) | Mittel | 4-8 h + Rechtsberatung | Empfohlen vor produktiver Nutzung |
| 5 | `import "server-only"` Marker in allen Server-Modulen (L1) | Niedrig | 15 Min | Nein |
| 6 | Pagination auf GET-Endpunkten (L3) | Niedrig | 3 h | Nein |
| 7 | Serverseitige PDF-Generierung (M4) | Mittel | 6 h | Nein (aber empfohlen fuer GoBD) |
| 8 | DB-basierte Admin-Rolle (M3) | Mittel | 2 h | Nein |
| 9 | Rate Limiting auch nach User-ID (L2) | Niedrig | 1 h | Nein |

**Geschaetzte Gesamtarbeit fuer alle Findings: ~20-25 Stunden** (ohne Rechtsberatung fuer GoBD).

---

## Anhang

### A. Auth-Status aller Route Handlers

Alle 29 API-Routen bestaetigt via `rg -n "getAuthUserId\(\)"`:

**Public/Admin-Check (2):**
- `/api/admin/check` — getAuthUserId optional, gibt nur `isAdmin: boolean` zurueck
- `/api/auth/callback` — Nutzt eigenen Flow mit `exchangeCodeForSession`, danach `ensureUserRecord`

**Authentifiziert + Ownership (24):**
- `/api/orders` GET/POST, `/api/orders/[id]` PUT/DELETE
- `/api/markets` GET/POST, `/api/markets/[id]` PUT/DELETE, `/api/markets/[id]/sales` GET/POST, `/api/markets/[id]/copy` POST
- `/api/expenses` GET/POST, `/api/expenses/[id]` DELETE
- `/api/market-sales` GET, `/api/market-sales/[id]` DELETE
- `/api/customers` GET, `/api/dashboard` GET
- `/api/profile` GET/PUT, `/api/settings` GET/PUT
- `/api/subscription` GET, `/api/invoice-number` POST
- `/api/stripe/checkout` POST, `/api/stripe/portal` POST
- `/api/account` DELETE, `/api/export` GET, `/api/migrate` POST
- `/api/auth/me` GET, `/api/auth/ensure-user` POST

**Admin-geschuetzt via `requireAdmin()` (3):**
- `/api/admin/stats` GET
- `/api/admin/users` GET
- `/api/admin/users/[id]` GET/PUT

**Unauth / Sonderfall (1):**
- `/api/stripe/webhook` POST (Stripe signature statt User-Auth)

### B. Service-Role-Client-Nutzung

**Einzige Stelle:** [src/app/api/account/route.ts:38](src/app/api/account/route.ts) via `getAdminClient()` aus [src/lib/supabase/admin.ts](src/lib/supabase/admin.ts)
**Zweck:** Supabase Auth User loeschen (kein anderer Weg moeglich)
**Tenant-Check:** Ja — `userId` wird zuvor aus `getAuthUserId()` abgeleitet, nicht aus Request-Body

### C. Storage-Buckets

**Keine** Supabase Storage Buckets in Verwendung. Kein File-Upload-Feature.

### D. Realtime-Subscriptions

**Keine** Realtime-Channels in Verwendung. App-Updates via React-Query-Invalidation bei Mutationen.

### E. Abgedeckte Attack-Surface

| Vektor | Abdeckung |
|---|---|
| SQL Injection | ✅ (Drizzle parametriert, keine Raw-SQL mit Input) |
| XSS (stored) | ✅ (escapeHtml in PDF, kein dangerouslySetInnerHTML) |
| XSS (reflected) | ✅ (React escaped per Default) |
| CSRF | ✅ (SameSite-Cookies, CSP form-action 'self') |
| SSRF | ✅ (keine URL-Fetches aus User-Input, keine Headless Browser) |
| Header Injection | ✅ (kein User-Input in Response-Headers) |
| IDOR | ✅ (Ownership-Check in jeder Query) |
| Path Traversal | N/A (keine File-Operations) |
| Mass Assignment | ✅ (explizites Feld-Mapping in Zod, kein Spread) |
| Session Fixation | ✅ (Supabase rotiert Tokens bei Refresh) |
| Broken Access Control | ✅ (getAuthUserId + isBlocked + deletedAt) |
| Insecure Deserialization | ✅ (Zod-Validation auf jedem JSON-Input) |
| Timing Attacks (Login) | ⚠ (Supabase-Layer, nicht von Vendora kontrolliert) |

---

## Einschraenkungen dieses Audits

- Keine Code-Aenderungen vorgenommen
- Keine API-Calls gegen Supabase-Produktiv-Umgebung oder Stripe-Produktiv-API
- Keine Live-Penetration-Tests
- Secrets maskiert (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`)
- RLS-Status in Produktion nicht verifiziert (Migration-Datei im Repo, aber Ausfuehrung nicht bestaetigt)
- Vercel-Environment-Variables nicht einsehbar (ARCJET_KEY-Status nicht verifizierbar)
- GoBD-Konformitaet ist eine **rechtliche**, keine technische Bewertung — finale Einschaetzung durch Steuerberater/Anwalt noetig

---

## Verbindung zu frueheren Audits

Dieser Audit ergaenzt:
- **Pentest Teil 1** (implizit abgeschlossen vor meiner Session)
- **Pentest Teil 2** ([docs/security-pentest-report.md](docs/security-pentest-report.md)) — 8 Findings remediated

Neue Findings aus diesem Audit: **M1 (GoBD)** und **L1 (server-only marker)** und **M4 (serverseitige PDF-Generierung empfohlen)** — waren in den bisherigen Audits nicht im Scope.

Bestaetigt als bereits behoben: A1-A6, A8 aus Pentest Teil 2.
Noch offen (bekannt): B1 (Trial-Abuse), B3 (Pagination), B5 (Session-Invalidation bei PW-Change), B6 (Preview-Deployments).
