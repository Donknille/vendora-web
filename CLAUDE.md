@AGENTS.md

# Vendora – Marktplatz-SaaS für Händler

Vendora ist eine Multi-Tenant SaaS-Plattform für Marktplatz-Händler (Bestellverwaltung, Produktkatalog, Finanzdashboard, Backup/Restore). Subscription-basiert mit Stripe Billing und kostenloser 42-Tage-Testphase.

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
src/
├── app/
│   ├── api/            # Route Handlers (REST)
│   │   ├── account/    # Account CRUD + Löschung
│   │   ├── orders/     # Bestell-Endpoints
│   │   ├── markets/    # Marktplatz-Endpoints
│   │   ├── products/   # Produkt-Endpoints
│   │   ├── profile/    # Profil-Endpoints
│   │   ├── stripe/     # Webhook + Checkout
│   │   ├── export/     # Datenexport (DSGVO Art. 20)
│   │   └── migrate/    # Backup Import/Export
│   ├── dashboard/      # Finanz-Dashboard + GuV
│   ├── orders/         # Bestellverwaltung UI
│   ├── markets/        # Marktplatz-Verwaltung UI
│   └── settings/       # User-Settings + Account-Löschung
├── components/         # Shared React Components
└── lib/
    ├── schema.ts       # Drizzle DB-Schema (single source of truth)
    ├── api-client.ts   # React Query Client + Query-Keys
    └── server/
        ├── auth.ts     # getAuthUserId, getAuthUserIdStrict, requireAdmin
        ├── storage.ts  # Alle DB-Queries (Drizzle)
        └── db.ts       # Drizzle-Postgres-Verbindung
```

## Befehle

```bash
npm run dev          # Dev-Server (localhost:3000)
npm run build        # Produktions-Build
npm run lint         # ESLint
npm test             # Vitest
tsc --noEmit         # Typcheck ohne Output
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
- Settings clientseitig in localStorage (LanguageContext, ThemeContext). Serverseitige Settings-Route und `app_settings`-Tabelle weitgehend ungenutzt.
- middleware.ts ist laut Next.js 16 deprecated, Migration auf proxy.ts steht aus.

## Weiterführende Docs

Lies diese Dateien nur bei Bedarf:

- `docs/known-issues.md` – Offene Findings aus dem Security-Audit
- `docs/security-policy.md` – Detaillierte Security-Richtlinien
- `docs/database-schema.md` – Schema-Details und Relationen
- `docs/stripe-integration.md` – Billing-Flow und Webhook-Events
- `docs/development-workflow.md` – Branching, PR, Deploy-Prozess
