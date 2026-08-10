# Backup-Runbook — Betriebssicherung der Produktionsdatenbank

> **Nicht zu verwechseln** mit dem In-App-„Backup & Restore" (Einstellungen →
> Backup, `/api/export` + `/api/migrate`). Das ist der Datenexport **für
> Nutzer:innen**. Dieses Dokument beschreibt die **Betriebssicherung der
> gesamten Datenbank** — was passiert, wenn die Produktionsdatenbank verloren
> geht.

---

## 1. Die wichtigste Zahl

**Wiederherstellungspunkt = der letzte Nachtlauf, 01:15 UTC.**

Alles, was seit dem letzten Nachtlauf entstanden ist, ist im Verlustfall weg.
Es gibt **kein** Point-in-Time-Recovery über diese Pipeline.

Zusätzlich, und unabhängig davon: Neon bietet auf dem **Free-Plan ein
History-Window von 6 Stunden** (Instant Restore, gedeckelt bei 1 GB History).
Geprüft am **10.08.2026** unter `https://neon.com/docs/introduction/history-window`.

Was das praktisch heißt:

| Fehler bemerkt | Rettbar über |
|---|---|
| innerhalb von 6 Stunden | Neon Instant Restore (minutengenau) |
| nach 6 Stunden bis ~24 h | diese Pipeline — Stand der letzten Nacht |
| nach Verlust des Neon-Projekts | **nur** diese Pipeline (Google Drive) |

**Bewusste Entscheidung vom 10.08.2026.** Ein Nachtlauf reicht für den aktuellen
Stand (kleine Nutzerzahl, Daten entstehen tagsüber am Marktstand und lassen sich
notfalls neu erfassen).

**Neu bewerten, sobald:** der erste zahlende Kunde da ist, oder mehr als ein
Dutzend aktive Konten. Dann Neon Launch (History-Window auf 7 Tage anheben,
Neon-Konsole → Project settings → Storage) und einen zweiten Lauf am Mittag prüfen.

**Warum überhaupt eine eigene Pipeline?** Weil Neons History am Neon-Projekt
hängt. Ein gelöschtes, gesperrtes oder wegen Zahlungsproblemen suspendiertes
Projekt nimmt sie mit. Dasselbe Argument gilt gegen einen Cron *innerhalb* von
Vercel oder Neon: identischer Blast-Radius.

---

## 2. Was jede Nacht passiert

`.github/workflows/backup.yml`, 01:15 UTC (vor dem mutierenden Vercel-Cron um
03:00 — ein fehlerhafter Cron-Lauf ist damit aus dem Backup desselben Morgens
rekonstruierbar).

| Schritt | Was | **Was es beweist** |
|---|---|---|
| `assert-backup-url` | Form des Secrets | die Pipeline redet mit einer echten, unpooled Neon-Verbindung |
| `inventory` | PG-Version, Schemata, Extensions, `pdf_url` | die Annahmen aus Phase 0 gelten heute noch |
| `prepare-snapshot --phase pre` | Canary + Zeilenzahlen + JSON je Tabelle | es gibt einen Messpunkt vor dem Dump, und einen Notausgang neben dem Binärformat |
| `pg_dump -Fc` | Dump von `public` + `drizzle` | — (allein beweist ein Dump gar nichts) |
| `prepare-snapshot --phase post` | Zeilenzahlen erneut | das erlaubte Band `[pre, post]` für den Vergleich |
| `pg_restore --exit-on-error` | Einspielen in eine Wegwerf-Datenbank | der Dump ist **einspielbar** — nicht nur vorhanden |
| `verify-restore` | sechs Prüfungen, dann `backup_verified` | der Inhalt stimmt: vollzählig, im Band, nicht leer, Canary da, keine Waisen, kein stiller Schwund |
| `age` + `sha256sum` | Verschlüsseln, Klartext löschen | das Archiv ist ohne den privaten Schlüssel wertlos |
| `rclone copy` | Google Drive `daily/` (+ `monthly/` am 1.) | der Stand überlebt den Verlust des GitHub-Kontos |
| Retention | `--min-age 90d`, nur `daily/` | 90 Tage Fenster für Fehler, die man nicht sofort bemerkt |

Die sechs Prüfungen im Restore-Drill (`script/backup/verify-restore.ts`):

1. alle Tabellen vorhanden (Liste aus dem Drizzle-Schema, nicht hartkodiert)
2. Zeilenzahlen im Band `[pre, post]`
3. `MUST_NOT_BE_EMPTY` je ≥ 1 — **der Leerdump-Detektor**
4. Canary aus derselben Nacht in der Kopie auffindbar
5. referenzielle Stichprobe (Waisen = 0)
6. Anomalie-Wächter: > 20 % **und** ≥ 5 Zeilen Schwund gegenüber dem letzten
   verifizierten Lauf

**Ein Backup, das nie wiederhergestellt wurde, ist kein Backup — es ist eine
Annahme.** Deshalb läuft der Drill täglich und nicht monatlich, und deshalb
läuft `pg_restore` mit `--exit-on-error`: ein Drill, der Fehler durchwinkt,
beweist nichts.

---

## 3. Wiederherstellung

Alle Befehle in **Git Bash** (Windows). Der private age-Schlüssel liegt im
Passwort-Manager, **nicht** in GitHub.

### 3.1 Archiv holen

Aus Google Drive (der verlässliche Weg — überlebt auch den Verlust des Repos):

```bash
rclone lsf gdrive:vendora-backups/daily | sort | tail -5
```

```bash
rclone copy "gdrive:vendora-backups/daily/<STAMP>" ./restore --progress
```

Alternativ die letzten 14 Tage aus GitHub (Actions → Backup → Lauf → Artifacts).
Der Inhalt ist identisch.

### 3.2 Prüfsumme, entschlüsseln, auspacken

```bash
cd restore && sha256sum -c vendora-*.tar.gz.age.sha256
```

```bash
age -d -i ~/vendora-backup-key.txt -o vendora.tar.gz vendora-*.tar.gz.age
```

```bash
mkdir -p entpackt && tar -xzf vendora.tar.gz -C entpackt && ls entpackt
```

Erwartet: `vendora.dump`, `json/`, `counts-pre.json`, `counts-post.json`,
`canary.json`, `manifest.json`, `verify-report.json`.

### 3.3 In eine Wegwerf-Datenbank einspielen — **nie über Produktion**

In der Neon-Konsole ein **neues, leeres Projekt** anlegen (z. B.
`vendora-restore-test`) und dessen **unpooled** Verbindungszeichenfolge nehmen.
Kein Branch des Produktionsprojekts: ein Tippfehler in der Zeichenfolge zielt
dort auf die echten Daten.

```bash
export RESTORE_URL='postgresql://...neon.tech/neondb?sslmode=require'
```

```bash
pg_restore -l entpackt/vendora.dump | grep -v "SCHEMA - public " > toc.restore
```

```bash
pg_restore --no-owner --no-privileges --exit-on-error --use-list=toc.restore --dbname="$RESTORE_URL" entpackt/vendora.dump
```

Der TOC-Filter ist nötig, weil jede frische Postgres-Datenbank `public` bereits
mitbringt. **Nicht** stattdessen das Schema droppen — darin lebten die
Extensions.

### 3.4 Plausibilität prüfen

```bash
psql "$RESTORE_URL" -c "select (select count(*) from users) as nutzer, (select count(*) from orders) as auftraege, (select count(*) from invoices) as rechnungen, (select count(*) from market_sales) as marktverkaeufe;"
```

Gegen `entpackt/verify-report.json` halten — dort stehen die Zahlen, die in der
Nacht gemessen wurden.

### 3.5 Zurück nach Produktion

Nur nach bestandener Plausibilitätsprüfung, und nur in eine **leere** Ziel-
datenbank (neues Neon-Projekt, `DATABASE_URL` in Vercel umstellen, redeployen).
Ein `pg_restore` über eine bestehende Datenbank mischt zwei Stände.

Nach dem Restore:

- **Alle Nutzer:innen müssen sich neu anmelden** (`session` ist ohne Daten
  gesichert). Passwörter funktionieren weiter — die Hashes liegen in `account`
  und sind enthalten.
- Offene E-Mail-Bestätigungs- und Reset-Links sind tot (`verification` ebenfalls
  ohne Daten).
- Stripe ist nicht betroffen; `webhook_events` ist mitgesichert, also werden
  Replays weiterhin korrekt ignoriert.

---

## 4. Wenn das Binärformat beschädigt ist

Neben `vendora.dump` liegt `json/<tabelle>.json` — eine Zeile-für-Zeile-Kopie
jeder Tabelle, gezogen in **einer** konsistenten Sicht
(`REPEATABLE READ READ ONLY`). Damit lässt sich von Hand rekonstruieren, was der
Dump nicht mehr hergibt.

`manifest.json` sagt, was **fehlt**:

| Tabelle | Warum ohne Daten |
|---|---|
| `session` | kurzlebig; nach einem Restore meldet sich ohnehin jeder neu an, und ein Archiv voller gültiger Session-Tokens wäre ein Geheimnis mehr |
| `verification` | dito (Bestätigungs- und Reset-Token, Laufzeit 1 h) |

Das **Schema** beider Tabellen ist gesichert, nur die Zeilen fehlen.

**`account` ist bewusst enthalten** — dort liegen die Better-Auth-Passwort-Hashes.
Die sind nicht wiederbeschaffbar. Genau deshalb muss das Archiv verschlüsselt sein.

---

## 5. Der Schlüssel

| | |
|---|---|
| **Öffentlicher Schlüssel** (`age1…`) | GitHub-Secret `BACKUP_AGE_RECIPIENT`. Damit kann man nur **ver**schlüsseln. |
| **Privater Schlüssel** (`AGE-SECRET-KEY-1…`) | Passwort-Manager **und** ausgedruckt an einem getrennten Ort. |

**Der private Schlüssel gehört NIEMALS in GitHub-Secrets.** Läge er dort, wohnte
er im selben Tresor wie der Google-Drive-Upload-Zugang — und die Verschlüsselung
schützte gegen nichts.

Dass die CI nicht entschlüsseln kann, ist kein Nachteil: der Restore-Drill läuft
im selben Lauf **vor** der Verschlüsselung, auf dem Klartext.

**Eigener Schlüssel je Projekt.** Nicht den Meisterplaner/KAVU-Schlüssel
wiederverwenden — sonst kompromittiert ein Schlüsselverlust beide Archivbestände.

Neu erzeugen:

```bash
age-keygen -o vendora-backup-key.txt
```

Die Zeile `# public key: age1…` daraus wird das Secret; die Datei kommt in den
Passwort-Manager und **nicht** ins Repository.

**Ein Schlüsselwechsel macht alle älteren Archive unlesbar.** Den alten privaten
Schlüssel aufbewahren, solange Archive damit verschlüsselt sind — also
mindestens 90 Tage (`daily/`) bzw. dauerhaft für `monthly/`.

---

## 6. Vierteljährlich von Hand — der Termin, der zählt

Kalendereintrag, 15 Minuten. Der automatische Drill prüft alles **außer dem
Schlüssel** — und ein Schlüssel, der nie benutzt wurde, ist ein verlorener
Schlüssel.

Ablauf: Abschnitt 3.1 bis 3.4 vollständig durchspielen, **mit dem privaten
Schlüssel aus dem Passwort-Manager**, auf einem Rechner ohne Zugriff auf die CI.
Ergebnis in die Tabelle in Abschnitt 9 eintragen. Danach das Wegwerf-Projekt in
Neon löschen.

Zusätzlich im selben Termin: **Alarm-Test** (Actions → Alarm-Test → Run workflow).

### Einmalige Vorbereitung: PostgreSQL-Werkzeuge

Auf diesem Rechner ist **kein Docker** installiert, und `pg_restore` muss die
**Hauptversion der Produktion sprechen — derzeit PostgreSQL 18**. Vor dem ersten
Quartalstest einmalig einrichten:

- **Windows:** EDB-Installer (`postgresql.org/download/windows`), Version 18, im
  Komponenten-Dialog **nur „Command Line Tools"** auswählen — keinen Server.
- **oder WSL:** `sudo apt install postgresql-client-18` (PGDG-Repository).

Prüfen:

```bash
pg_restore --version && psql --version
```

---

## 7. Die projektspezifische Falle: der falsche Neon-Branch

Neon-Branches sind **schema-identisch und leer**. Zeigt `BACKUP_DATABASE_URL`
versehentlich auf einen frischen Branch, läuft `pg_dump` fehlerfrei durch,
`pg_restore` ebenfalls, und der Zeilenvergleich `pre`/`post` passt formal —
beide Seiten sind 0.

Abgefangen wird das von genau zwei Prüfungen:

- **Canary** (Prüfung 4): der Token wird unmittelbar vor dem Dump in die
  Datenbank geschrieben. Fehlt er in der Kopie, war es eine andere Datenbank.
- **`MUST_NOT_BE_EMPTY`** (Prüfung 3): `user`, `users`, `account` müssen je
  mindestens eine Zeile haben.

**Diese Grenzen dürfen nicht abgeschwächt werden.** Wer sie aufweicht, entfernt
die Sicherung — nicht die Warnung.

(Das Supabase-Pendant wäre RLS gewesen: dort liefert `pg_dump` bei
`FORCE ROW LEVEL SECURITY` ohne `BYPASSRLS` **0 Zeilen bei Exit-Code 0**.
Vendora hat kein RLS, der Zugriffsschutz sitzt in der Anwendung. Der Detektor
ist derselbe.)

Zweiter Fallstrick, gleicher Ursprung: **der Neon-Pooler.** `pg_dump` braucht
Session-State und scheitert über PgBouncer. `BACKUP_DATABASE_URL` muss die
**unpooled** Zeichenfolge sein — Host **ohne** `-pooler`.
`script/backup/assert-backup-url.ts` bricht sonst als erster Schritt ab.

---

## 8. Einrichtung und Secrets

### 8.1 GitHub → Settings → Secrets and variables → Actions

| Secret | Inhalt |
|---|---|
| `BACKUP_DATABASE_URL` | Neon-**unpooled**-URI, `?sslmode=require`, Sonderzeichen prozentkodiert |
| `BACKUP_AGE_RECIPIENT` | öffentlicher age-Key (`age1…`) |
| `RCLONE_GDRIVE_TOKEN` | JSON aus `rclone authorize drive` |
| `RCLONE_GDRIVE_CLIENT_ID` / `_SECRET` | eigene Google-OAuth-Daten (sonst geteiltes rclone-Kontingent) |
| `HEALTHCHECK_URL` | healthchecks.io-Ping-URL, **Period 1 Tag / Grace 8 h** |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASSWORD` `EMAIL_FROM` | wörtlich aus Vercel kopieren, nicht neu tippen |
| `ALERT_EMAIL_TO` | Zieladresse für Betriebsalarme |

### 8.2 Sonstiges

- **GitHub → Settings → Notifications → Actions → „Send notifications for failed
  workflows only"** aktivieren. Ohne das kommt die kostenlose erste Alarmstufe
  nicht an.
- **Vercel (Production):** `ALERT_EMAIL_TO` setzen **und einmal neu deployen** —
  Env-Änderungen wirken erst nach einem Redeploy. Ohne das läuft der App-Wächter
  weiter mit leerem Wert und loggt nur.
- **Vercel:** `CRON_SECRET` muss gesetzt sein, sonst antwortet
  `/api/cron/retention` mit 503 und der App-Wächter läuft nie.
- **Google Drive:** Ordner `vendora-backups/` anlegen. Eigener Ordner ist
  Pflicht: derselbe rclone-Token sieht bei `scope=drive.file` die Dateien
  **aller** Projekte, die ihn benutzen — ein Retention-Schritt mit falschem Pfad
  könnte fremde Stände löschen.
- **Migration `0019` in Produktion anwenden**, sonst existiert `backup_events`
  dort nicht und der erste Lauf scheitert. Beim allerersten Mal über den
  Notausgang, weil der Guard noch keinen Nachweis finden kann:
  ```bash
  npm run db:migrate:unsafe
  ```

### 8.3 Drei Alarmkanäle plus Testknopf

| Fall | Kanal |
|---|---|
| Lauf schlägt fehl | GitHub-Mail + eigene SMTP-Mail (`notify-failure.ts`) + healthchecks `/fail` |
| Lauf startet gar nicht | healthchecks.io Dead-Man-Switch |
| Lauf bleibt länger aus | App-Wächter im Vercel-Cron → Mail nach 36 h |
| **Alarmkette prüfen** | Actions → **Alarm-Test** → Run workflow |

Der App-Wächter (`src/lib/server/backupWatchdog.ts`) hängt bewusst weder an
GitHub noch an healthchecks.io: er deckt den Fall ab, dass GitHub geplante
Workflows nach **60 Tagen ohne Repo-Aktivität** stilllegt.

---

## 9. Protokolle

### 9.1 Manuelle Restore-Tests (vierteljährlich)

| Datum | Archiv-Stand | Ergebnis | Wer |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

### 9.2 Alarm-Tests (vierteljährlich)

| Datum | Kanal | Mail im Postfach? | Wer |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |

---

## 10. Abnahme der Ersteinrichtung

Erst wenn **alle** Punkte zutreffen, ist die Pipeline fertig. **Merge zählt
nicht — der erste grüne Lauf zählt.**

- [ ] Migration `0019` in Produktion angewendet
- [ ] Secrets aus 8.1 gesetzt
- [ ] Workflow von Hand gestartet (`npm run backup:now`) und **grün**
- [ ] Ergebniszeile nennt Archivgröße, `sha256`, `canary=ok` **und den Datenstand**
- [ ] `rclone lsf gdrive:vendora-backups/daily` zählt die Datei im echten Drive nach
- [ ] Der Restore-Drill hat **mindestens einmal rot** ausgeschlagen, als man ihn
      absichtlich brach (z. B. `MUST_NOT_BE_EMPTY` in `script/backup/lib.ts` um
      eine erfundene Tabelle erweitern). Ein Wächter, der noch nie ausgelöst hat,
      ist unbewiesen.
- [ ] Alarm-Test gelaufen **und die Mail liegt im Postfach** (nicht im Spam)
- [ ] healthchecks.io meldet den Lauf, Period/Grace gesetzt
- [ ] `npm run db:migrate` gegen Produktion bricht ohne frisches Backup ab
      (einmal ausprobiert)
- [ ] Erster manueller Restore-Test durchgeführt und in 9.1 protokolliert
- [ ] Kalendereintrag „Vendora: Restore-Test + Alarm-Test", vierteljährlich
