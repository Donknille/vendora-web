# Vendora Web – Setup-Anleitung

Vendora ist eine Business-Management-Web-App (Bestellungen, Märkte/Marktverkäufe, Ausgaben,
Rechnungsnummern, Firmenprofil) mit Abo-Modell. Diese Anleitung beschreibt, wie du das Projekt
lokal einrichtest und deployst.

## Tech-Stack

| Bereich        | Technologie                                                        |
| -------------- | ------------------------------------------------------------------ |
| Framework      | Next.js 16 (App Router), React 19, TypeScript                      |
| Auth           | Supabase Auth (`@supabase/ssr`)                                    |
| Datenbank      | Supabase Postgres, Zugriff über Drizzle ORM (`postgres-js`)        |
| Migrationen    | Drizzle Kit (`drizzle-kit push`)                                   |
| Zahlungen      | Stripe (Subscriptions: Checkout, Customer Portal, Webhook)         |
| Rate Limiting  | Arcjet (Shield + Fixed Window)                                     |
| UI             | Tailwind CSS v4, TanStack Query, lucide-react, motion              |
| Validierung    | Zod                                                                |
| Tests          | Vitest, Testing Library                                            |

## 1. Voraussetzungen

- **Node.js 22** (die CI läuft auf Node 22 – siehe `.github/workflows/security.yml`)
- **npm** (das Repo nutzt `package-lock.json` / `npm ci`)
- **Git**
- Ein **Supabase**-Projekt (Auth + Postgres)
- Ein **Stripe**-Konto (Test- oder Live-Modus)
- Ein **Arcjet**-Konto (für Rate Limiting; in Production zwingend erforderlich, siehe Schritt 6)

## 2. Schnellstart

```bash
git clone https://github.com/Donknille/vendora-web.git
cd vendora-web
npm install

# Umgebungsvariablen anlegen und ausfüllen
cp .env.local.example .env.local
#   -> Werte in .env.local eintragen (siehe Abschnitt 3)

# Datenbank-Schema anlegen
npm run db:push
#   -> danach RLS-Policies ausführen (siehe Abschnitt 4)

# Dev-Server starten
npm run dev
```

App läuft anschließend unter **http://localhost:3000**.

## 3. Umgebungsvariablen

Alle Variablen werden in `.env.local` gesetzt (Vorlage: `.env.local.example`).

| Variable                            | Pflicht                    | Beschreibung / Bezugsquelle                                                                 |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`          | ✅                         | Projekt-URL: Supabase → Project Settings → API                                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | ✅                         | Anon/Public Key: Supabase → Project Settings → API                                          |
| `SUPABASE_SERVICE_ROLE_KEY`         | ✅                         | Service-Role-Key (nur serverseitig!): Supabase → Project Settings → API. Für Admin-Ops (z. B. User löschen) |
| `DATABASE_URL`                      | ✅                         | Direkte Postgres-Verbindung für Drizzle. Supabase → Connect → **Transaction Pooler** (Port 6543) |
| `ADMIN_EMAILS`                      | ✅                         | Kommaseparierte Liste der Admin-E-Mails (Zugriff auf `/admin`)                              |
| `STRIPE_SECRET_KEY`                 | ✅                         | Stripe → Developers → API keys (`sk_test_...` / `sk_live_...`)                              |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`| ➖ aktuell ungenutzt       | In der Vorlage enthalten, wird im Code derzeit **nicht** referenziert (Checkout läuft serverseitig). Nur nötig für künftiges client-seitiges Stripe.js: Stripe → Developers → API keys (`pk_...`) |
| `STRIPE_WEBHOOK_SECRET`             | ✅                         | Signing-Secret des Webhook-Endpoints (`whsec_...`, siehe Abschnitt 5)                       |
| `ARCJET_KEY`                        | ⚠️ Prod-Pflicht, lokal optional | Arcjet-Dashboard → API-Key (`ajkey_...`). Siehe Abschnitt 6                             |

> **Hinweis zu `DATABASE_URL`:** Es wird der Supabase **Transaction Pooler** (Port `6543`) verwendet.
> Der DB-Client läuft daher mit `prepare: false` und `ssl: "require"` (`src/lib/server/db.ts`).

## 4. Datenbank einrichten

1. **Schema pushen** – erzeugt alle Tabellen aus `src/lib/server/schema.ts` in der Supabase-DB:

   ```bash
   npm run db:push
   ```

   Tabellen: `users`, `orders`, `order_items`, `market_events`, `market_sales`, `expenses`,
   `company_profiles`, `app_settings`, `invoice_counters`.

2. **Row Level Security aktivieren** – die Datei `src/sql/rls-policies.sql` im
   **Supabase SQL Editor** ausführen. Sie aktiviert RLS auf allen Tabellen und stellt sicher,
   dass jede*r Nutzer*in ausschließlich eigene Daten sehen/ändern kann – auch bei direktem
   Zugriff über den Supabase-Client.

Weitere DB-Skripte:

| Skript                | Zweck                                                     |
| --------------------- | --------------------------------------------------------- |
| `npm run db:push`     | Schema direkt in die DB pushen (Dev)                      |
| `npm run db:generate` | SQL-Migrationsdateien aus dem Schema generieren           |
| `npm run db:studio`   | Drizzle Studio (DB-Browser) öffnen                        |

## 5. Supabase Auth konfigurieren

- **Redirect-URLs** (Supabase → Authentication → URL Configuration): für lokale Entwicklung
  `http://localhost:3000/**`, für Production die Prod-Domain ergänzen. Der Auth-Callback läuft
  über `/api/auth/callback`.
- **E-Mail-Templates**: Unter `src/emails/` liegen fertige HTML-Vorlagen
  (`confirm-signup.html`, `magic-link.html`, `reset-password.html`, `invite-user.html`,
  `change-email.html`). Diese können in Supabase → Authentication → Email Templates hinterlegt werden.

## 6. Stripe einrichten

1. **Produkt + Preis** anlegen (Stripe → Product catalog). Der Code referenziert aktuell eine
   **fest hinterlegte Price-ID** in `src/lib/server/stripe.ts`:

   ```ts
   export const STRIPE_PRICE_ID = "price_1TLMf7RvBVbOJnhsnhujvSmR";
   ```

   Für ein eigenes Stripe-Konto muss diese ID auf den eigenen Preis angepasst werden.

2. **Webhook-Endpoint** anlegen (Stripe → Developers → Webhooks):
   - URL: `https://<deine-domain>/api/stripe/webhook` (lokal via Stripe CLI, siehe unten)
   - Zu abonnierende Events:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `customer.subscription.deleted`
   - Das **Signing Secret** (`whsec_...`) als `STRIPE_WEBHOOK_SECRET` eintragen.

   > Ohne gültiges `STRIPE_WEBHOOK_SECRET` weist der Endpoint alle Webhooks ab (fail-closed).

3. **Lokales Testen** mit der Stripe CLI:

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

## 7. Arcjet (Rate Limiting) einrichten

Arcjet schützt die App (Shield gegen gängige Angriffe + Rate Limits, u. a. strenger für
Auth-Endpoints). Konfiguration in `src/lib/server/arcjet.ts`, Einbindung in `src/middleware.ts`.

- **Lokal**: `ARCJET_KEY` ist optional. Fehlt er (und `NODE_ENV !== production`), wird Rate
  Limiting einfach übersprungen.
- **Production**: `ARCJET_KEY` ist **Pflicht**. Ist er nicht gesetzt, antwortet die Middleware
  mit `503` auf **alle** Requests (fail-closed). Vor jedem Prod-Deploy also unbedingt setzen.

## 8. Admin-Zugang

Der Admin-Bereich (`/admin`) ist nur für E-Mails erreichbar, die in `ADMIN_EMAILS`
(kommasepariert) hinterlegt sind – siehe `src/lib/server/admin.ts`.

## 9. Skripte

| Skript                | Zweck                                             |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Dev-Server (http://localhost:3000)                |
| `npm run build`       | Production-Build                                  |
| `npm start`           | Production-Server (nach `build`)                  |
| `npm run lint`        | ESLint                                            |
| `npm test`            | Tests einmalig (Vitest)                           |
| `npm run test:watch`  | Tests im Watch-Modus                              |
| `npm run db:push`     | DB-Schema pushen                                  |
| `npm run db:generate` | Migrationen generieren                            |
| `npm run db:studio`   | Drizzle Studio                                    |

## 10. Tests & Qualitätssicherung

Vor einem Commit/Push sollten dieselben Checks wie in der CI grün sein
(`.github/workflows/security.yml`):

```bash
npm audit --audit-level=high
npx tsc --noEmit
npm run lint
npm test
npm run build
```

## 11. Deployment (Vercel)

1. Repo mit Vercel verbinden (Framework: Next.js).
2. **Alle** Umgebungsvariablen aus Abschnitt 3 in Vercel setzen –
   inkl. **`ARCJET_KEY` (Prod-Pflicht)** und `SUPABASE_SERVICE_ROLE_KEY`.
3. Stripe-Webhook-URL auf die Production-Domain aktualisieren
   (`https://<prod-domain>/api/stripe/webhook`) und das neue `STRIPE_WEBHOOK_SECRET` in Vercel hinterlegen.
4. Supabase Redirect-URLs um die Production-Domain ergänzen.

Security-Header (HSTS, CSP, X-Frame-Options u. a.) sind bereits in `next.config.ts` konfiguriert.

## 12. Projektstruktur (Kurzüberblick)

```
src/
  app/                # Next.js App Router
    (app)/            # Eingeloggter Bereich (dashboard, orders, markets, expenses, admin, settings)
    api/              # Route Handler (auth, orders, markets, expenses, stripe, admin, migrate, ...)
    auth/             # Login, Registrierung, Passwort-Reset
    legal/            # AGB, Datenschutz, Impressum, Changelog
  components/         # UI-Komponenten (Sidebar, ui/*)
  emails/             # HTML-Vorlagen für Supabase Auth-Mails
  lib/
    server/           # DB (Drizzle), Schema, Auth, Storage, Stripe, Arcjet, Admin
    supabase/         # Supabase-Clients (client, server, middleware, admin)
    hooks/            # React-Query-Hooks
  sql/rls-policies.sql # Row-Level-Security-Policies (im Supabase SQL Editor ausführen)
  middleware.ts       # Auth-Session + Rate Limiting
```

## 13. Sicherheit (Kurzüberblick)

- **Row Level Security** auf allen Tabellen (`src/sql/rls-policies.sql`).
- **Rate Limiting / Shield** via Arcjet (fail-closed in Production).
- **Stripe-Webhooks** mit Signaturprüfung (fail-closed ohne Secret).
- **Security-Header** inkl. Content-Security-Policy in `next.config.ts`.
- **Service-Role-Key** wird ausschließlich serverseitig verwendet (`src/lib/supabase/admin.ts`).
