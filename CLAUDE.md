@AGENTS.md

# Vendora – Marktplatz-SaaS für Händler

Vendora ist eine Multi-Tenant SaaS-Plattform für Markthändler:innen (Auftrags- & Rechnungsverwaltung, Marktmodus, EÜR-/Finanzdashboard, Backup/Restore). Subscription-basiert mit Stripe Billing und kostenloser 42-Tage-Testphase. Die geplante Neuausrichtung ist in `docs/REBUILD-PLAN.md` dokumentiert.

## Stack

- **Runtime:** Next.js 16 (App Router), TypeScript strict
- **Auth:** Better Auth (Session-Cookies, Drizzle-Adapter; Tabellen in `src/lib/server/auth-schema.ts`, Config in `src/lib/auth.ts`)
- **DB:** PostgreSQL (Neon-hosted), Drizzle ORM ≥0.45.2
- **Payments:** Stripe (Subscriptions, Webhooks, Checkout)
- **Deployment:** Vercel
- **State:** TanStack React Query (api-client.ts)
- **Validation:** Zod

## Projektstruktur

```
drizzle/                 # Versionierte SQL-Migrationen (db:generate)
src/
├── app/
│   ├── (app)/          # Eingeloggter Bereich (Route-Group, Server-Layout mit Session-Gate)
│   │   ├── dashboard/  # Finanz-Dashboard + GuV
│   │   ├── orders/     # Auftragsverwaltung + Rechnung
│   │   ├── markets/    # Marktmodus (Quick-Sale, Live-Gewinn)
│   │   ├── expenses/   # Ausgabenerfassung
│   │   ├── admin/      # Admin-Panel (ADMIN_EMAILS-Gate)
│   │   └── settings/   # Firmenprofil + Account-Löschung + Backup
│   ├── api/            # Route Handlers (REST)
│   │   ├── account/    # Account-Löschung (DSGVO Art. 17)
│   │   ├── orders/     # Bestell-Endpoints
│   │   ├── markets/    # Markt-Endpoints (+ [id]/sales, [id]/copy)
│   │   ├── market-sales/ # Alle Marktverkäufe (Dashboard)
│   │   ├── expenses/   # Ausgaben-Endpoints
│   │   ├── profile/    # Firmenprofil
│   │   ├── stripe/     # Webhook + Checkout + Portal
│   │   ├── export/     # Datenexport (DSGVO Art. 20)
│   │   └── migrate/    # Backup Import (Restore)
│   └── legal/          # Impressum, Datenschutz, AGB, Changelog
├── components/         # Shared React Components
└── lib/
    ├── api-client.ts       # React Query Client + Query-Keys
    ├── formatCurrency.ts   # Cent<->Euro-Konvertierung (Anzeige/Eingabe)
    └── server/
        ├── schema.ts       # Drizzle DB-Schema (single source of truth)
        ├── auth.ts         # getAuthUserId, requireActiveSubscription
        ├── admin.ts        # isAdmin, requireAdmin (ADMIN_EMAILS)
        ├── storage.ts      # Alle DB-Queries (Drizzle)
        ├── env.ts          # Zod-validierte Server-Env-Variablen
        └── db.ts           # Drizzle-Postgres-Verbindung
```

## Befehle

```bash
npm run dev          # Dev-Server (localhost:3000)
npm run build        # Produktions-Build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest
npm run db:generate  # Migration aus Schemaänderung erzeugen (-> drizzle/)
npm run db:push      # Nur für lokale Experimente
```

## Verifikation nach Änderungen

Nach JEDER Code-Änderung diese Reihenfolge durchlaufen:

1. `tsc --noEmit`
2. `npm run lint`
3. `npm test`
4. `npm run build`

Erst wenn alle vier Schritte grün sind, darf committed werden.

## Security-Regeln (NICHT VERHANDELBAR)

Diese Regeln gelten ausnahmslos für jede Code-Änderung:

### Auth & Access Control
- JEDER API Route Handler MUSS `getAuthUserId()` aus `lib/server/auth.ts` aufrufen und bei `null` mit 401 abbrechen
- JEDE DB-Query MUSS einen `WHERE user_id = ?` Ownership-Check haben
- Admin-Endpunkte MÜSSEN `requireAdmin()` verwenden
- Blockierte User (`is_blocked = true`) dürfen KEINEN Zugriff haben
- Serverseitig: Session immer über `getAuthUserId()` (Better Auth `auth.api.getSession`, DB-validiert) prüfen

### Secrets & Keys
- `BETTER_AUTH_SECRET` und alle Secrets NIEMALS in Client-Code oder `NEXT_PUBLIC_*`
- KEINE hardcodierten API-Keys, Tokens oder Passwörter im Code
- Secrets nur in `.env.local` (nicht committed) oder Vercel Environment Variables

### Stripe
- Webhook-Handler MUSS Signatur mit `stripe.webhooks.constructEvent()` verifizieren
- Fehlendes `STRIPE_WEBHOOK_SECRET`: sofort `500`, NICHT ohne Prüfung verarbeiten
- Events idempotent verarbeiten (Event-ID tracken)
- Body mit `request.text()` lesen, NICHT `request.json()`

### Input & Output
- JEDER User-Input mit Zod-Schema validieren
- HTML-Output escapen – KEIN `dangerouslySetInnerHTML` mit User-Daten
- API-Responses: nur benötigte Felder zurückgeben

### Datenbank
- Multi-Step-Operationen in DB-Transaktionen
- Lösch-Endpunkte: bei "nicht gefunden" NICHT pauschal 200 zurückgeben
- Copy/Import-Endpunkte MÜSSEN Subscription-Limits prüfen

### React Query / Cache
- Query-Keys user-scoped: `[userId, 'resource']`
- Bei signOut/signIn/Account-Löschung: `queryClient.clear()`
- User-spezifische Seiten: `export const dynamic = 'force-dynamic'`

## Code-Konventionen

- TypeScript strict mode, keine `any` Types
- Funktionale React-Komponenten mit Hooks
- Kein `setState` in `useEffect` ohne Cleanup
- Destructured Imports: `import { eq } from 'drizzle-orm'`
- try/catch in allen Route Handlers, Fehlermeldungen ohne interne Details
- Kein `console.log` in Production (nur `console.error` für echte Fehler)

## DSGVO-Anforderungen

- Account-Löschung (Art. 17): Better Auth User (inkl. Sessions) + Stripe Customer + alle DB-Zeilen entfernen
- Datenexport (Art. 20): `/api/export` exportiert alle User-Daten als JSON
- Nur essentielle Auth-Cookies, kein Tracking ohne Consent
- Datensparsamkeit: nur speichern, was funktional notwendig ist

## Bekannte Architektur-Entscheidungen

- Direkte Postgres-Verbindung via Drizzle (db.ts) gegen Neon. Auth-Tabellen (`user`/`session`/`account`/`verification`) verwaltet Better Auth (auth-schema.ts); die App-`users`-Tabelle ist das Profil, gekeyt auf `better-auth user.id`.
- **Geld = Integer-Cents** in DB, API und State. Umrechnung Euro↔Cent nur an der UI-Grenze (`formatCurrency.ts`: `parseAmount` bei Eingabe, `formatCurrency`/`formatAmountInput` bei Anzeige). Keine Float-Arithmetik auf Beträgen.
- **Datumsfelder** der Domäne sind `date` (ISO-String), `createdAt`/`updatedAt` sind `timestamptz` (im Response als ISO-String serialisiert).
- **Migrationen** liegen versioniert in `drizzle/`. Jede Schemaänderung: `npm run db:generate` und die erzeugte Migration mitcommitten. `db:push` nur lokal.
- **Server-Env** wird zentral in `src/lib/server/env.ts` per Zod validiert (fail-fast). `import "server-only"` in allen `src/lib/server/*`-Logikmodulen.
- Settings (Theme/Sprache) leben clientseitig in localStorage (LanguageContext, ThemeContext). Es gibt keine serverseitige Settings-Route/`app_settings`-Tabelle mehr.
- Proxy-Konvention `src/proxy.ts` (Next.js 16, Node.js-Runtime → kein 1-MB-Edge-Limit) statt der deprecateten `middleware.ts`. Enthält Arcjet-Rate-Limiting + optimistischen Better-Auth-Cookie-Check (echte Session-Validierung passiert in Routen/Layout).

## Weiterführende Docs

- `docs/REBUILD-PLAN.md` – Vollständiger Überarbeitungsplan (Phasen 0–5), Ist-Zustand, Zielbild, Abnahmekriterien
- `SETUP.md` – Lokales Setup (Neon, Better Auth, Env-Variablen, Migrationen)
- `AGENTS.md` – Gemeinsame Agent-Regeln (Antigravity, Cursor, Claude Code)

Die früher hier gelisteten `docs/*.md` (known-issues, security-policy, database-schema, stripe-integration, development-workflow) existieren nicht.
