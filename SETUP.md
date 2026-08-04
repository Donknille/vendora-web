# Vendora Web – Setup-Anleitung

Vendora ist eine Business-Management-Web-App für Markthändler:innen (Aufträge & Rechnungen,
Marktmodus/Marktverkäufe, Ausgaben, EÜR-/Finanzdashboard, Firmenprofil) mit Abo-Modell.
Diese Anleitung beschreibt das lokale Setup und Deployment.

## Tech-Stack

| Bereich        | Technologie                                                        |
| -------------- | ------------------------------------------------------------------ |
| Framework      | Next.js 16 (App Router), React 19, TypeScript strict               |
| Auth           | Better Auth (E-Mail/Passwort, Drizzle-Adapter, Session-Cookies)    |
| Datenbank      | Neon Postgres, Zugriff über Drizzle ORM (`postgres-js`)            |
| Migrationen    | Drizzle Kit – versioniert in `drizzle/` (`db:generate` + `db:migrate`) |
| Zahlungen      | Stripe (Subscriptions: Checkout, Customer Portal, Webhook)         |
| E-Mail         | Resend (Passwort-Reset, E-Mail-Bestätigung)                        |
| Rate Limiting  | Arcjet (Shield + Fixed Window) in `src/proxy.ts`                   |
| UI             | Tailwind CSS v4, TanStack Query, lucide-react, motion              |
| Validierung    | Zod                                                                |
| Tests          | Vitest                                                             |

## 1. Voraussetzungen

- **Node.js 22** (die CI läuft auf Node 22 – siehe `.github/workflows/security.yml`)
- **npm** (das Repo nutzt `package-lock.json` / `npm ci`)
- **Git**
- Ein **Neon**-Projekt (Postgres, EU-Region empfohlen)
- Ein **Stripe**-Konto (Test- oder Live-Modus)
- Optional: **Resend**-Konto (E-Mail) und **Arcjet**-Konto (Rate Limiting; in Production Pflicht)

## 2. Schnellstart

```bash
git clone https://github.com/Donknille/vendora-web.git
cd vendora-web
npm install

# Umgebungsvariablen anlegen und ausfüllen
cp .env.local.example .env.local
#   -> Werte in .env.local eintragen (siehe Abschnitt 3)

# Datenbank-Schema per Migration anlegen
npm run db:migrate

# Dev-Server starten
npm run dev
```

App läuft anschließend unter **http://localhost:3000**.

## 3. Umgebungsvariablen

Alle Variablen werden in `.env.local` gesetzt (Vorlage: `.env.local.example`). Sie werden beim
Start zentral über `src/lib/server/env.ts` per Zod validiert – fehlt eine Pflichtvariable,
bricht der Dev-Server/Runtime mit einer klaren Meldung ab (fail-fast).

| Variable                | Pflicht                          | Beschreibung / Bezugsquelle                                                                 |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | ✅                               | Gepoolte Neon-Verbindung (Neon-Konsole → Connection Details → **Pooled**). `?sslmode=require` beibehalten. |
| `BETTER_AUTH_SECRET`    | ✅                               | Secret zum Signieren von Sessions. Erzeugen: `openssl rand -base64 32`                       |
| `BETTER_AUTH_URL`       | ➖ (empfohlen)                   | Öffentliche Basis-URL ohne Trailing-Slash. Lokal `http://localhost:3000`                     |
| `ADMIN_EMAILS`          | ➖                               | Kommaseparierte Liste der Admin-E-Mails (Zugriff auf `/admin`)                              |
| `STRIPE_SECRET_KEY`     | ➖ (Pflicht für Billing)         | Stripe → Developers → API keys (`sk_test_...` / `sk_live_...`)                              |
| `STRIPE_WEBHOOK_SECRET` | ➖ (Pflicht für Webhook)         | Signing-Secret des Webhook-Endpoints (`whsec_...`, siehe Abschnitt 5)                       |
| `RESEND_API_KEY`        | ➖ (Pflicht für E-Mail)          | Resend → API keys (`re_...`). Ohne Key werden E-Mails mit Warnung übersprungen.             |
| `EMAIL_FROM`            | ➖                               | Absenderadresse, z. B. `Vendora <noreply@deine-domain.de>` (verifizierte Resend-Domain)     |
| `ARCJET_KEY`            | ⚠️ Prod-Pflicht, lokal optional | Arcjet-Dashboard → API-Key (`ajkey_...`). Siehe Abschnitt 6                                  |

> **Hinweis zu `DATABASE_URL`:** Es wird die **gepoolte** Neon-Verbindung verwendet. Der DB-Client
> läuft daher mit `prepare: false` und `ssl: "require"` (`src/lib/server/db.ts`).

> **Auth-Tabellen:** Better Auth verwaltet `user`/`session`/`account`/`verification`
> (`src/lib/server/auth-schema.ts`). Die App-`users`-Tabelle ist das Profil, gekeyt auf die
> Better-Auth-`user.id`. E-Mail-Verifizierung ist aktuell deaktiviert
> (`requireEmailVerification: false` in `src/lib/auth.ts`), bis eine Resend-Domain live ist.

## 4. Datenbank einrichten (Migrationen)

Das Schema liegt in `src/lib/server/schema.ts` (+ Auth-Tabellen in `auth-schema.ts`). Änderungen
werden **versioniert** als Migration in `drizzle/` abgelegt und angewendet.

```bash
npm run db:migrate     # alle Migrationen aus drizzle/ auf die DB anwenden
```

Workflow bei Schemaänderungen:

| Skript                | Zweck                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| `npm run db:generate` | Neue Migration aus Schemadiff erzeugen (Datei in `drizzle/` committen) |
| `npm run db:migrate`  | Ausstehende Migrationen anwenden (Dev **und** Prod/Deploy)            |
| `npm run db:push`     | Schema ohne Migration direkt pushen – **nur für lokale Experimente**  |
| `npm run db:studio`   | Drizzle Studio (DB-Browser) öffnen                                    |

> Es gibt **kein** Row Level Security wie unter Supabase. Zugriffsschutz erfolgt
> anwendungsseitig: jede Query ist über `getAuthUserId()` + `WHERE user_id = ?` an den
> eingeloggten Account gebunden.

## 5. Stripe einrichten

1. **Produkt + Preis** anlegen (Stripe → Product catalog). Der Code referenziert aktuell eine
   **fest hinterlegte Price-ID** in `src/lib/server/stripe.ts`:

   ```ts
   export const STRIPE_PRICE_ID = "price_1TLMf7RvBVbOJnhsnhujvSmR";
   ```

   Für ein eigenes Stripe-Konto muss diese ID angepasst werden. (Wird in einer späteren Phase
   auf Env/Config umgestellt – siehe `docs/REBUILD-PLAN.md`, Phase 4.)

2. **Webhook-Endpoint** anlegen (Stripe → Developers → Webhooks):
   - URL: `https://<deine-domain>/api/stripe/webhook` (lokal via Stripe CLI, siehe unten)
   - Events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
   - Das **Signing Secret** (`whsec_...`) als `STRIPE_WEBHOOK_SECRET` eintragen.

   > Ohne gültiges `STRIPE_WEBHOOK_SECRET` weist der Endpoint alle Webhooks ab (fail-closed).
   > Events werden idempotent verarbeitet (Event-ID in `webhook_events`), Replays werden ignoriert.

3. **Lokales Testen** mit der Stripe CLI:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

## 6. Arcjet (Rate Limiting)

Arcjet schützt die App (Shield + Rate Limits, strenger für Auth-Endpoints). Konfiguration in
`src/lib/server/arcjet.ts`, Einbindung in `src/proxy.ts` (Node-Runtime-Proxy statt `middleware.ts`).

- **Lokal**: `ARCJET_KEY` optional. Fehlt er (und `NODE_ENV !== production`), wird Rate Limiting übersprungen.
- **Production**: `ARCJET_KEY` ist **Pflicht**. Ohne Key antwortet der Proxy fail-closed mit `503`.

## 7. Admin-Zugang

Der Admin-Bereich (`/admin`) ist nur für E-Mails erreichbar, die in `ADMIN_EMAILS`
(kommasepariert) hinterlegt sind – siehe `src/lib/server/admin.ts`.

## 8. Tests & Qualitätssicherung

Vor Commit/Push dieselben Checks wie in der CI (`.github/workflows/security.yml`) grün ziehen:

```bash
npm audit --audit-level=high
npm run typecheck
npm run lint
npm test
npm run build
```

## 9. Deployment (Vercel)

1. Repo mit Vercel verbinden (Framework: Next.js).
2. **Alle** Umgebungsvariablen aus Abschnitt 3 in Vercel setzen – inkl. **`ARCJET_KEY` (Prod-Pflicht)**.
3. Migrationen auf die Prod-DB anwenden: `npm run db:migrate` (mit Prod-`DATABASE_URL`).
4. Stripe-Webhook-URL auf die Production-Domain aktualisieren und das neue `STRIPE_WEBHOOK_SECRET` hinterlegen.
5. `BETTER_AUTH_URL` auf die Production-Domain setzen; in Resend die Absender-Domain verifizieren.

Security-Header (HSTS, CSP, X-Frame-Options u. a.) sind in `next.config.ts` konfiguriert.

## 10. Projektstruktur (Kurzüberblick)

```
drizzle/                # Versionierte SQL-Migrationen
src/
  app/
    (app)/              # Eingeloggter Bereich (dashboard, orders, markets, expenses, admin, settings)
    api/                # Route Handler (auth, orders, markets, market-sales, expenses, profile, stripe, admin, export, migrate)
    auth/               # Login, Registrierung, Passwort-Reset
    legal/              # AGB, Datenschutz, Impressum, Changelog
  components/           # UI-Komponenten (Sidebar, ui/*)
  lib/
    auth.ts             # Better Auth Instanz
    formatCurrency.ts   # Cent<->Euro-Konvertierung
    server/             # db, schema, auth, admin, storage, stripe, arcjet, email, env, pagination
    hooks/              # React-Query-Hooks
  proxy.ts              # Better-Auth-Cookie-Check + Arcjet Rate Limiting (Node-Runtime)
```

Weiterführend: `docs/REBUILD-PLAN.md` (Überarbeitungsplan), `CLAUDE.md` / `AGENTS.md` (Agent-/Coding-Regeln).
