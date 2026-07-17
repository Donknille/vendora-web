# Vendora – Lokales Setup & Datenbank neu aufsetzen

Kurzanleitung, um `vendora-web` **lokal** zu entwickeln und die Datenbank auf einem
**neuen Supabase-Projekt** neu aufzusetzen.

> Hintergrund: Die komplette DB-Struktur liegt als Code im Repo (Drizzle-Schema +
> RLS-Policies). Es müssen also keine Daten „mitgenommen" werden – die Datenbank
> lässt sich auf jedem frischen Supabase-Projekt in zwei Schritten neu erzeugen.

## Voraussetzungen

- **Node.js ≥ 20.9** (LTS 20 oder 22)
- **Git**
- Optional: **Claude Code CLI** (`npm i -g @anthropic-ai/claude-code`, dann `claude` im Projektordner)

## 1. Repo klonen & Abhängigkeiten installieren

```bash
git clone <repo-url> vendora-web
cd vendora-web
git checkout master
npm install
```

## 2. Umgebungsvariablen anlegen (`.env.local`)

`.env.local` ist bewusst **nicht** eingecheckt. Vorlage ist `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Anschließend mit echten Werten füllen:

| Variable | Woher |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Dashboard → Project Settings → **API** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase-Dashboard → Project Settings → **API** |
| `DATABASE_URL` | Supabase-Dashboard → Project Settings → **Database** (Connection String inkl. Passwort) |
| `ADMIN_EMAILS` | Kommagetrennte Admin-E-Mails (z.B. die eigene) |
| `STRIPE_SECRET_KEY` | Stripe-Dashboard → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe-Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe-Dashboard → Developers → Webhooks (bzw. `stripe listen` lokal) |

## 3. Datenbank auf dem (neuen) Supabase-Projekt erzeugen

Das DB-Schema wird per **Drizzle** aus `src/lib/server/schema.ts` erzeugt, die
Sicherheits-Policies aus `src/sql/rls-policies.sql`.

1. **Tabellen anlegen** (nutzt `DATABASE_URL` aus `.env.local`):
   ```bash
   npm run db:push
   ```
2. **RLS-Policies einspielen**: Inhalt von `src/sql/rls-policies.sql` im
   Supabase-Dashboard → **SQL Editor** ausführen.

> Tipp: Falls `db:push` über den Transaction-Pooler (Port `6543`) Fehler wirft,
> in `DATABASE_URL` für den Push die **Session/Direct Connection** (Port `5432`)
> aus dem Dashboard verwenden.

Optional zum Prüfen der Tabellen:
```bash
npm run db:studio
```

## 4. App starten

```bash
npm run dev      # http://localhost:3000
npm test         # Tests (vitest)
```

## Umzug auf einen neuen Supabase-Account

1. Neuen Supabase-Account anlegen, neues Projekt erstellen (Region z.B. `eu-west-1`).
2. Schritte aus **Abschnitt 2 + 3** mit den Werten des neuen Projekts durchführen.
3. Falls die App auf Vercel deployt wird: die gleichen Env-Variablen dort
   (Project → Settings → Environment Variables) auf das neue Projekt umstellen.
4. `.env.local.example` bei Bedarf auf die neue Projekt-Ref aktualisieren.

## Nützliche npm-Scripts

| Script | Zweck |
|---|---|
| `npm run dev` | Dev-Server (Next.js) |
| `npm run build` / `npm start` | Production-Build / -Start |
| `npm run db:push` | Drizzle-Schema in die DB pushen |
| `npm run db:generate` | Drizzle-Migrationen generieren |
| `npm run db:studio` | Drizzle Studio (DB-Browser) |
| `npm test` | Tests (vitest) |
| `npm run lint` | ESLint |
