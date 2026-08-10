/**
 * Phase 0 als wiederkehrende Pruefung — nicht als einmalige Notiz.
 *
 * Die Inventur bei Projektstart beantwortet Fragen, die sich spaeter still
 * aendern: eine neue Postgres-Hauptversion, ein neues Schema, eine neue
 * Extension, ein neuer Datenspeicher. Jede dieser Aenderungen faellt sonst
 * erst beim Restore auf — wenn ueberhaupt. Deshalb laeuft sie bei JEDEM Lauf
 * und bricht ab, statt zu warnen.
 *
 * Ausgabe: `extensions_sql` nach $GITHUB_OUTPUT, damit der Restore-Schritt die
 * noetigen CREATE-EXTENSION-Zeilen aus der Produktionsdatenbank ableitet statt
 * aus einer hartkodierten Liste, die veraltet.
 */
import {
  DUMP_SCHEMAS,
  FOREIGN_SCHEMA_ROW_ALLOWANCE,
  allTableNames,
  connect,
  requireEnv,
  safeScalar,
} from "./lib";
import { fail, info, isMain, setOutput } from "./cli";

const EXPECTED_MAJOR = process.env.PG_MAJOR ?? "18";

async function main(): Promise<void> {
  const sql = connect(requireEnv("BACKUP_DATABASE_URL"));
  const problems: string[] = [];

  try {
    // --- 1. Hauptversion ---------------------------------------------------
    // Ein 18er-Dump in eine 17er-Datenbank ist nicht unterstuetzt und kann
    // TEILWEISE durchlaufen — schlimmer als ein klarer Fehler.
    const [{ version, server }] = await sql<{ version: string; server: string }[]>`
      select version() as version, current_setting('server_version') as server
    `;
    const major = server.split(".")[0];
    info(`Postgres: ${version.split(",")[0]}`);
    if (major !== EXPECTED_MAJOR) {
      problems.push(
        `Produktion laeuft auf Postgres ${major}, die Pipeline ist auf ${EXPECTED_MAJOR} ` +
          "gepinnt. PG_IMAGE, den Restore-Service-Container und PG_MAJOR in " +
          ".github/workflows/backup.yml angleichen — Dump und Restore muessen " +
          "dieselbe Hauptversion sprechen."
      );
    }

    // --- 2. Schemata -------------------------------------------------------
    // Vergessene Schemata fallen sonst erst beim Restore auf, wenn ueberhaupt.
    const foreign = await sql<{ schema: string; table: string; rows: string }[]>`
      select n.nspname as schema,
             c.relname as table,
             coalesce(s.n_live_tup, 0)::text as rows
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_stat_user_tables s on s.relid = c.oid
       where c.relkind = 'r'
         and n.nspname not in ('pg_catalog', 'information_schema')
         and n.nspname not like 'pg_toast%'
         and n.nspname <> all (${sql.array([...DUMP_SCHEMAS])})
       order by 1, 2
    `;

    for (const row of foreign) {
      const key = `${row.schema}.${row.table}`;
      // n_live_tup ist eine Schaetzung; bei Verdacht exakt nachzaehlen, damit
      // eine ungenaue Statistik keinen Fehlalarm ausloest.
      const allowed = FOREIGN_SCHEMA_ROW_ALLOWANCE[key] ?? 0;
      if (Number(row.rows) <= allowed) continue;

      const exact = await safeScalar(
        sql,
        `select count(*) as value from "${row.schema}"."${row.table}"`
      );
      if (exact !== null && exact <= allowed) continue;

      problems.push(
        `Schema ausserhalb des Dumps enthaelt Daten: ${key} (${exact ?? row.rows} Zeilen, ` +
          `erlaubt ${allowed}). Entweder das Schema in DUMP_SCHEMAS aufnehmen oder — ` +
          "wenn es bewusst nicht gesichert wird — die Ausnahme in " +
          "FOREIGN_SCHEMA_ROW_ALLOWANCE begruenden."
      );
    }

    // --- 3. Extensions -----------------------------------------------------
    // pg_dump --schema=... exportiert KEINE Extensions (die haengen an der
    // Datenbank, nicht am Schema). Sie muessen im Restore-Ziel vorab existieren,
    // sonst scheitern Constraints und Indizes, die darauf aufbauen.
    const extensions = await sql<{ extname: string }[]>`
      select extname from pg_extension where extname <> 'plpgsql' order by 1
    `;
    const names = extensions.map((e) => e.extname);
    info(`Extensions: ${names.length > 0 ? names.join(", ") : "(nur plpgsql)"}`);
    await setOutput(
      "extensions_sql",
      names.map((name) => `CREATE EXTENSION IF NOT EXISTS "${name}";`).join("\n")
    );

    // --- 4. Zweiter Datenspeicher ------------------------------------------
    // Vendora legt keine Dateien ab: Rechnungs-PDFs entstehen on demand
    // (src/lib/server/invoicePdf.ts), invoices.pdf_url ist reserviert und leer.
    // Sobald dort etwas steht, gibt es Objekte ausserhalb der Datenbank — ein
    // reiner DB-Restore stellte dann Metadaten wieder her, die ins Leere zeigen.
    const withPdf = await safeScalar(
      sql,
      `select count(*) as value from "public"."invoices" where pdf_url is not null`
    );
    if (withPdf === null) {
      problems.push("invoices.pdf_url liess sich nicht pruefen (Abfrage fehlgeschlagen).");
    } else if (withPdf > 0) {
      problems.push(
        `${withPdf} Rechnungen haben ein pdf_url. Damit existiert ein zweiter ` +
          "Datenspeicher, den dieses Backup NICHT erfasst. Schritt 4 des " +
          "Backup-Auftrags (Objekte sichern) nachziehen, bevor der Lauf wieder " +
          "gruen sein darf."
      );
    }

    // --- 5. Schema-Drift ---------------------------------------------------
    const expected = allTableNames();
    const present = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'
    `;
    const have = new Set(present.map((r) => r.table_name));
    const missing = expected.filter((name) => !have.has(name));
    if (missing.length > 0) {
      problems.push(
        `Diese Tabellen stehen im Drizzle-Schema, fehlen aber in der Zieldatenbank: ` +
          `${missing.join(", ")}. Entweder zeigt BACKUP_DATABASE_URL auf den falschen ` +
          "Neon-Branch, oder eine Migration wurde nie angewendet."
      );
    }
    info(`Tabellen in public: ${have.size} (erwartet mindestens ${expected.length})`);
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (problems.length > 0) fail(problems);
  info("OK: Inventur bestanden.");
}

if (isMain(import.meta.url)) {
  main().catch((err: unknown) => {
    fail(`Inventur fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  });
}
