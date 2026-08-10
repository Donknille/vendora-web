# Von Supabase auf Neon umstellen — Schritt für Schritt

Vollständige 1:1-Anleitung. Alle Befehle in **PowerShell** im Projektordner
`C:\Users\sebgr\Coding\Vendora`.

## Was „Umstellung" überhaupt bedeutet

Die Umstellung besteht aus vier unabhängigen Teilen. Zwei davon sind erledigt:

| # | Teil | Status |
|---|---|---|
| 1 | **Code** — Supabase-Client raus, Better Auth + Drizzle/Neon rein | ✅ erledigt (Branch `migrate/neon-betterauth`) |
| 2 | **DB** — Neon-Schema auf Migrationsstand `0000`–`0015` | ✅ erledigt (Stand 2026-08-07 verifiziert) |
| 3 | **Vercel Production** — Env-Variablen von Supabase auf Neon | ✅ erledigt (2026-08-07 verifiziert: Production 200/401 statt 500, keine Supabase-Fehler seit 2026-08-04) |
| 4 | **Supabase abschalten** — Projekt löschen, Kosten stoppen | ⬜ **offen — Teil C unten** |

Wenn du nur wissen willst, was noch zu tun ist: **nur noch Teil C**. Teil A und B sind
erledigt; sie bleiben als Referenz stehen, falls das Ganze nochmal von vorn nötig wird.

---

## Teil 0 — Grundwissen (einmal lesen, dann vergessen)

**Neon hat zwei Connection-Strings pro Datenbank.** Der Unterschied ist ein `-pooler`
im Hostnamen:

```
# DIREKT (ohne -pooler)  -> für Migrationen (db:migrate)
postgresql://USER:PASS@ep-tiny-mountain-as2f9l3u.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require

# POOLED (mit -pooler)   -> für die laufende App (Vercel)
postgresql://USER:PASS@ep-tiny-mountain-as2f9l3u-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require
```

Merksatz: **App = pooled, Migration = direkt.** Die App auf Vercel öffnet sehr viele
kurze Verbindungen (Serverless) — dafür ist der Pooler da. Migrationen ändern das
Schema und brauchen eine echte Session, die der Pooler nicht garantiert.

Beide findest du in der Neon-Konsole unter **Project → Connect** (Schalter
„Connection pooling" an/aus).

---

## Teil A — Vercel Production auf Neon umstellen

Hier liegt der eigentliche offene Schritt. Vercel kennt aktuell noch die
Supabase-Variablen.

### A.1 — Alte Variablen entfernen

Vercel → Projekt **vendora-web** → **Settings** → **Environment Variables**.
Diese drei löschen (alle Environments):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### A.2 — Neue Variablen anlegen

Jeweils für **Production**, **Preview** und **Development** setzen:

| Variable | Wert | Pflicht? |
|---|---|---|
| `DATABASE_URL` | Neon-**pooled**-String (mit `-pooler`) | **ja** |
| `BETTER_AUTH_SECRET` | Zufalls-Secret, siehe unten | **ja** |
| `BETTER_AUTH_URL` | `https://vendora-web-peach.vercel.app` (bzw. deine Domain) | **ja** |
| `STRIPE_SECRET_KEY` | `sk_live_…` bzw. `sk_test_…` | für Billing |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` aus dem Stripe-Webhook | für Billing |
| `STRIPE_PRICE_ID` | `price_…` des Pro-Produkts (19,90 €/Monat) | für Billing |
| `ARCJET_KEY` | Arcjet-Key | empfohlen |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.strato.de` / `465` | für E-Mails |
| `SMTP_USER` / `SMTP_PASSWORD` | Postfach-Adresse und Postfach-Passwort | für E-Mails |
| `EMAIL_FROM` | z. B. `Vendora <info@deine-domain.de>` | für E-Mails |
| `ADMIN_EMAILS` | `seb.grueber@gmail.com` | für `/admin` |

Ein Secret erzeugst du so:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

> **Wichtig:** `BETTER_AUTH_SECRET` in Production **nicht** identisch mit dem lokalen
> Wert wählen, und niemals als `NEXT_PUBLIC_*` anlegen — es ist ein Server-Secret.

### A.3 — Migrationen auf die Production-DB anwenden

Nutzt Production dieselbe Neon-DB wie lokal (aktuell der Fall), ist dieser Schritt
**schon erledigt** — überspringen und bei A.4 weitermachen.

Nutzt Production eine **eigene** Neon-DB, einmalig lokal gegen diese DB migrieren.
Dafür den **direkten** String (ohne `-pooler`) nur für diese eine Shell-Session setzen:

```powershell
$env:DATABASE_URL="postgresql://USER:PASS@ep-....neon.tech/neondb?sslmode=require"
npm run db:migrate
```

Danach das PowerShell-Fenster schließen, damit die Variable nicht hängen bleibt.

### A.4 — Deployen

```bash
gh pr merge 10 --merge
```

Oder in GitHub auf [PR #10](https://github.com/Donknille/vendora-web/pull/10) →
**Merge**. Das löst automatisch den Production-Deploy aus.

> Der aktuelle Production-Deploy ist rot („Edge Function `_middleware` size is 1.11 MB").
> Der Merge behebt das mit, weil im Branch `middleware.ts` → `proxy.ts` (Node-Runtime)
> umgestellt wurde.

---

## Teil B — Prüfen, ob es funktioniert hat

Nach dem Deploy auf der Production-URL:

1. **Registrieren** mit einer echten E-Mail → du landest im Dashboard.
   Klappt das, funktionieren Neon + Better Auth zusammen.
2. **Auftrag anlegen**, Status auf **„bezahlt"** setzen (prüft `paid_at`).
3. **Rechnung ausstellen** → **PDF herunterladen** (prüft die `invoices`-Tabelle).
4. **Ausgabe erfassen** und **Markt mit Standgebühr** anlegen.
5. **`/steuer`** öffnen → Einnahmen/Ausgaben/Überschuss müssen stimmen → **CSV** und
   **PDF** exportieren.
6. **`/admin`** öffnen (geht nur mit einer E-Mail aus `ADMIN_EMAILS`).

Gegenprobe direkt in der DB — Neon-Konsole → **SQL Editor**:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY 1;
```

Erwartet werden diese 16 Tabellen:

```
account, company_profiles, customers, euer_exports, expenses, invoice_counters,
invoices, market_events, market_sales, order_items, orders, session, user, users,
verification, webhook_events
```

Und der Migrationsstand (muss **14** Zeilen liefern, `0000`–`0013`):

```sql
SELECT count(*) FROM drizzle.__drizzle_migrations;
```

---

## Teil C — Supabase abschalten

**Erst machen, wenn Teil B vollständig grün ist.** Danach gibt es kein Zurück.

1. Sicherstellen, dass in Supabase keine Daten liegen, die du noch brauchst
   (Supabase-Konsole → **Table Editor** durchsehen). Im Zweifel:
   **Database** → **Backups** → Dump herunterladen und lokal ablegen.
2. Supabase-Konsole → **Project Settings** → **General** → ganz unten
   **Delete project**.
3. Im Repo prüfen, dass nichts mehr auf Supabase zeigt:

   ```bash
   git grep -in supabase -- ":!docs" ":!*.md"
   ```

   Erwartet sind genau **zwei** Treffer, beide in
   `src/app/legal/changelog/page.tsx` — das ist der historische Changelog-Text
   („Umzug der Datenbank von Supabase auf Neon"), kein aktiver Code. Jeder
   weitere Treffer wäre ein echter Rest.

---

## Anhang 1 — Lokale Umgebung neu aufbauen

Falls du das Setup auf einem anderen Rechner oder von Null brauchst.

**1. Abhängigkeiten:**

```bash
npm install
```

**2. `.env.local` anlegen** — Vorlage kopieren und ausfüllen:

```powershell
Copy-Item .env.local.example .env.local
```

Minimal nötig, damit die App startet: `DATABASE_URL` (Neon **direkt**) und
`BETTER_AUTH_SECRET`. Alles andere ist optional — die Features schalten sich
sauber ab, wenn die Keys fehlen.

**3. Schema anlegen:**

```bash
npm run db:migrate
```

`drizzle.config.ts` liest `.env.local` selbst ein — du musst `DATABASE_URL` also
**nicht** von Hand exportieren.

**4. Starten:**

```bash
npm run dev
```

→ http://localhost:3000

**5. Optional, Daten ansehen:**

```bash
npm run db:studio
```

---

## Anhang 2 — Eine DB mit altem Schema zurücksetzen

Nötig, wenn eine Datenbank ursprünglich per `db:push` entstanden ist. Sie hat dann
Tabellen, aber **kein** Migrations-Journal — `db:migrate` scheitert an
`relation "..." already exists`.

> **Das löscht alle Daten dieser Datenbank.** Vorher in der Neon-Konsole →
> **Branches** → *Create branch* einen Point-in-Time-Snapshot als Rollback-Punkt
> anlegen (gratis und sofort).

Neon-Konsole → **SQL Editor** (richtige DB/Branch auswählen!):

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
DROP SCHEMA IF EXISTS drizzle CASCADE;
```

Danach lokal:

```bash
npm run db:migrate
```

Das legt alle 16 Tabellen frisch an und schreibt das Journal mit. Bestehende Konten
sind weg — alle registrieren sich neu, das ist so gewollt.

**Alternative ohne Datenverlust:** in Neon eine **neue Branch** anlegen, deren
Connection-String in `.env.local` eintragen und dort `npm run db:migrate` laufen
lassen. Die alte DB bleibt unangetastet.

---

## Ab jetzt: die Dauerregel

Jede Schemaänderung läuft ab sofort so:

```bash
npm run db:generate   # erzeugt drizzle/00XX_*.sql aus schema.ts
npm run db:migrate    # wendet sie auf die DB an
```

Die erzeugte SQL-Datei **immer mitcommitten**. **Kein `db:push` mehr** — das umgeht
das Journal und führt genau zu dem Zustand, den Anhang 2 repariert.

---

## Troubleshooting

| Fehler | Ursache & Lösung |
|---|---|
| `DATABASE_URL is required` bei `npm run dev` | `.env.local` fehlt oder die Zeile fehlt. Server neu starten — Next liest `.env.local` nur beim Start. |
| `DATABASE_URL is not defined` bei `db:migrate` | `.env.local` liegt nicht im Projektordner. Notfalls: `$env:DATABASE_URL="postgresql://…"` in der Shell setzen. |
| `relation "..." already exists` | DB hat Tabellen ohne Journal → **Anhang 2**. |
| `password authentication failed` | Falscher/abgelaufener String. In Neon → **Connect** neu kopieren; bei Bedarf **Reset password**. |
| SSL-/Verbindungsfehler | `?sslmode=require` fehlt am Ende des Strings. |
| `ECONNREFUSED` / Timeout | Neon-Compute schläft (Scale-to-Zero). Einmal in der Konsole eine Query absetzen, dann geht es. |
| Deploy `ERROR`, Build war grün | Meist Env-Problem oder das Edge-Size-Limit. Log lesen: Vercel → Deployment → **Building**. |
