# DB-Migration auf Neon anwenden

**Ziel:** Die Neon-Datenbank auf den aktuellen Migrationsstand (`drizzle/0000`–`0005`) bringen.

**Ausgangslage:** Die DB wurde ursprünglich per `db:push` mit dem **alten** Schema erstellt
(numeric/text, ohne `paid_at`, `expenses.market_id/source`, `is_small_business`, `webhook_events`).
Ein `db:migrate` würde deshalb an „Tabelle existiert bereits" scheitern. Lösung: **sauberer
Neustart** — Tabellen weg, dann Migrationen 0000–0005 frisch anwenden. Laut Projektstand gibt es
keine wertvollen Daten (bewusst „frischer Start").

> Alle Befehle in PowerShell im Projektordner `C:\Users\sebgr\Coding\Vendora`.

---

## Variante A — bestehende Neon-DB zurücksetzen (empfohlen)

**1. Sicherheits-Snapshot (empfohlen, Neon-spezifisch & gratis):**
Neon-Konsole → **Branches** → *Create branch* (von `main`). Sofortiger Point-in-Time-Snapshot als
Rollback-Punkt.

**2. Tabellen leeren** — Neon-Konsole → **SQL Editor** (richtige Datenbank/Branch) → ausführen:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
-- Falls aus früheren Versuchen vorhanden (sonst ignorieren):
DROP SCHEMA IF EXISTS drizzle CASCADE;
```

Entfernt alle alten Tabellen (App **und** Better Auth: `user/session/account/verification`) —
Nutzer registrieren sich danach neu, das ist gewollt.

**3. Migrationen anwenden (lokal):**

```powershell
npm run db:migrate
```

Wendet `0000_init` … `0005_small_business_flag` der Reihe nach an. Nutzt dieselbe `DATABASE_URL`
wie zuvor `db:push` (aus `.env.local` via `drizzle.config.ts`).

**4. Prüfen:**

```powershell
npm run db:studio
```

Oder im Neon SQL Editor:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;
```

Erwartet u. a.: `orders` (mit `paid_at`, `payment_method`), `expenses` (mit `market_id`, `source`),
`company_profiles` (mit `is_small_business`), `webhook_events`, plus `user/session/account/verification`.

---

## Variante B — neue Neon-Branch/DB (noch sauberere Trennung)

1. Neon-Konsole → neue **Branch** oder neue **Datenbank** anlegen.
2. Deren **pooled** Connection-String kopieren (`…-pooler.…neon.tech/neondb?sslmode=require`).
3. In `.env.local` `DATABASE_URL` auf die neue DB setzen.
4. `npm run db:migrate` — läuft auf leerer DB direkt durch.

---

## Danach: App gegenprüfen

```powershell
npm run dev
```

Im Browser (localhost:3000): registrieren → Auftrag anlegen und auf **„bezahlt"** setzen (prüft
`paid_at`) → Ausgabe erfassen → Markt mit Standgebühr anlegen → **`/steuer`** öffnen
(Einnahmen/Ausgaben/Überschuss) → **CSV** und **PDF** exportieren.

**Ab jetzt gilt:** Schemaänderung → `npm run db:generate` (Migration mitcommitten) →
`npm run db:migrate`. **Kein `db:push`** mehr (außer Wegwerf-Experimente).

---

## Für die Produktion (Vercel), beim Go-Live

Reihenfolge:

1. **Migration auf die Prod-DB** anwenden — denselben `db:migrate`-Befehl lokal mit der **Prod**-`DATABASE_URL`
   ausführen. Wenn lokal und Prod dieselbe Neon-DB nutzen, reicht ein Lauf.
2. **Vercel-Env** final setzen (`DATABASE_URL` = Neon **pooled**, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `STRIPE_*`, `ARCJET_KEY`, optional `RESEND_API_KEY`/`EMAIL_FROM`).
3. **PR #10 → `master`** mergen (löst den Prod-Deploy aus).

---

## Troubleshooting

- **`DATABASE_URL is not defined`** bei `db:migrate` → in der PowerShell-Session setzen und erneut:
  ```powershell
  $env:DATABASE_URL="postgresql://USER:PASS@ep-...-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
  npm run db:migrate
  ```
- **`relation "..." already exists`** → Tabellen waren nicht (vollständig) gedroppt; Schritt 2
  (Variante A) nochmal ausführen.
- **SSL-/Verbindungsfehler** → sicherstellen, dass die **pooled** URL mit `?sslmode=require` verwendet wird.
