# Vendora

Multi-Tenant-SaaS für Markthändler:innen: Auftrags- & Rechnungsverwaltung, Marktmodus
(Kassen-light für Marktstände), Ausgabenerfassung und EÜR-/Finanzdashboard – mit Backup/Restore
und Stripe-Abo.

**Stack:** Next.js 16 (App Router) · Better Auth · Neon Postgres + Drizzle ORM · Stripe · Resend ·
Arcjet · Tailwind v4 · TanStack Query · Zod · Vitest.

## Loslegen

```bash
npm install
cp .env.local.example .env.local   # Werte eintragen
npm run db:migrate                 # Schema anwenden
npm run dev                        # http://localhost:3000
```

Vollständige Anleitung (Env-Variablen, Neon, Stripe, Deployment): **[SETUP.md](SETUP.md)**.

## Entwicklung

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm test            # Vitest
npm run build       # Produktions-Build
```

Diese vier Checks müssen vor jedem Commit grün sein.

## Dokumentation

- **[docs/REBUILD-PLAN.md](docs/REBUILD-PLAN.md)** – Überarbeitungsplan (Phasen 0–5), Ist-Zustand, Zielbild
- **[CLAUDE.md](CLAUDE.md)** / **[AGENTS.md](AGENTS.md)** – Coding- & Security-Regeln, Architektur-Entscheidungen
- **[SETUP.md](SETUP.md)** – Lokales Setup & Deployment

## Konventionen (Kurzfassung)

- Jeder API-Endpunkt prüft Auth **und** Ownership (`getAuthUserId()` + `WHERE user_id`).
- Geld ist überall **Integer-Cents**; Euro↔Cent nur an der UI-Grenze (`src/lib/formatCurrency.ts`).
- Schemaänderungen als versionierte Migration (`npm run db:generate`, dann mitcommitten).
- Secrets nur in `.env.local` / Vercel; validiert über `src/lib/server/env.ts`.
