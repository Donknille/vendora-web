/**
 * Gemeinsame Helfer der Backup-Pipeline.
 *
 * WICHTIG: kein Import aus src/lib/server/*. Diese Module tragen "server-only"
 * und ziehen die Zod-Env-Validierung nach sich; im GitHub-Runner gibt es
 * weder das eine noch das andere, und die Pipeline darf nicht an der
 * App-Bootstrap-Validierung haengen. src/lib/server/schema.ts ist die Ausnahme:
 * es ist frei von "server-only" und die einzige Quelle der Tabellenliste.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import postgres, { type Sql, type TransactionSql } from "postgres";
import * as schema from "../../src/lib/server/schema";
import { classifyDbUrl } from "./dbUrlKind";

/** Schemata, die in den Dump gehoeren. */
export const DUMP_SCHEMAS = ["public", "drizzle"] as const;

/**
 * Der Drizzle-Migrationsjournal. Muss mitgesichert werden — ohne ihn weiss eine
 * wiederhergestellte Datenbank nicht, welche Migrationen liefen, und
 * `db:migrate` spielt alles erneut ein.
 */
export const MIGRATIONS_TABLE = { schema: "drizzle", name: "__drizzle_migrations" } as const;

/**
 * Schemata ausserhalb von DUMP_SCHEMAS, in denen Zeilen erlaubt sind.
 *
 * `neon_auth` ist eine ungenutzte Neon-Installation (Vendora authentifiziert
 * ueber Better Auth in `public`); nur die von Neon selbst angelegte
 * Konfigurationszeile steht dort. Alles darueber hinaus waere ein Schema, das
 * jemand in Betrieb genommen hat, ohne das Backup anzupassen — die Inventur
 * bricht dann ab, statt es still zu uebergehen.
 */
export const FOREIGN_SCHEMA_ROW_ALLOWANCE: Record<string, number> = {
  "neon_auth.project_config": 1,
};

/**
 * Kurzlebige Tabellen: Schema ja, Daten nein.
 *
 * Nach einem Restore meldet sich ohnehin jeder neu an, und ein Archiv voller
 * gueltiger Session-Tokens waere ein Geheimnis mehr, das man huetet.
 * `account` ist BEWUSST nicht dabei: dort liegen die Passwort-Hashes, und die
 * sind nicht wiederbeschaffbar. Genau deshalb muss das Archiv verschluesselt sein.
 */
export const DATA_EXCLUDED_TABLES = ["session", "verification"] as const;

/**
 * Untergrenzen — der Leerdump-Detektor.
 *
 * Faengt den Fall "Quelle und Kopie sind beide leer, der Vergleich passt
 * formal". Bei Neon ist der realistische Ausloeser ein falscher Branch: der ist
 * schema-identisch und leer, ein Dump davon laeuft fehlerfrei durch.
 * Diese Liste enthaelt nur, was in einer lebenden Vendora-Datenbank
 * strukturell nicht leer sein KANN — keine Nutzer heisst keine App.
 * Nicht abschwaechen: wer die Grenzen aufweicht, entfernt die Sicherung.
 */
export const MUST_NOT_BE_EMPTY = ["user", "users", "account"] as const;

/**
 * Kerntabellen fuer den Anomalie-Waechter (stiller Schwund gegenueber dem
 * letzten verifizierten Backup). Geschaeftsdaten, die wachsen sollten.
 */
export const CORE_TABLES = [
  "orders",
  "order_items",
  "customers",
  "market_events",
  "market_sales",
  "expenses",
  "invoices",
] as const;

/**
 * Schwelle des Anomalie-Waechters: Alarm erst bei mehr als 20 % Schwund UND
 * mindestens 5 Zeilen absolut.
 *
 * Der absolute Boden ist kein Weichspueler, sondern noetig: bei den aktuellen
 * Bestaenden (einstellige Zeilenzahlen) waere eine einzelne geloeschte Zeile
 * bereits ein Viertel. Ein Waechter, der bei normaler Nutzung schreit, wird
 * abgeschaltet — und dann faengt er auch den echten Fall nicht mehr. Mit
 * wachsenden Daten greift die Prozentregel von allein.
 */
export const ANOMALY_DROP_RATIO = 0.2;
export const ANOMALY_DROP_MIN_ROWS = 5;

export type Counts = Record<string, number | null>;

/**
 * Alles, worauf sich eine Abfrage absetzen laesst — die Verbindung selbst oder
 * eine laufende Transaktion. Der Snapshot misst innerhalb einer Transaktion,
 * der Restore-Drill ausserhalb.
 */
export type Queryable = Sql | TransactionSql;

/** Alle Tabellennamen aus dem Drizzle-Schema — nicht hartkodiert, waechst mit. */
export function allTableNames(): string[] {
  const names = new Set<string>();
  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) names.add(getTableName(value));
  }
  return [...names].sort();
}

/** Tabellen, deren Daten in Dump und JSON-Export gehoeren. */
export function dataTableNames(): string[] {
  const excluded = new Set<string>(DATA_EXCLUDED_TABLES);
  return allTableNames().filter((name) => !excluded.has(name));
}

/**
 * Verbindung fuer die Backup-Skripte. `max: 1`, weil hier nichts parallel
 * laeuft, und mit grosszuegigem statement_timeout: der App-Default ist fuer
 * Volltabellen-Exporte zu knapp.
 */
export function connect(url: string): Sql {
  const isLocal = classifyDbUrl(url) === "local";
  return postgres(url, {
    max: 1,
    prepare: false,
    ssl: isLocal ? false : "require",
    connection: { statement_timeout: 600_000 },
    onnotice: () => {},
  });
}

/**
 * Liest einen Skalar und liefert bei JEDEM Fehler `null` statt zu werfen.
 *
 * Grund: ein beschaedigter Snapshot darf die Backup-Funktion nicht zum Absturz
 * bringen. Stuerzt sie ab, gibt es keinen Bericht — und ohne Bericht keinen
 * Alarm. Ein `null` ist sichtbar und wird von den Pruefungen als Fehlschlag
 * gewertet; eine Exception waere schlicht Stille.
 */
export async function safeScalar(sql: Queryable, query: string): Promise<number | null> {
  try {
    const rows = await sql.unsafe<{ value: string | number }[]>(query);
    const raw = rows[0]?.value;
    if (raw === undefined || raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function qualify(table: string, schemaName = "public"): string {
  return `"${schemaName}"."${table}"`;
}

/** Zeilenzahlen aller Tabellen inkl. Migrationsjournal. */
export async function collectCounts(sql: Queryable, tables: string[]): Promise<Counts> {
  const counts: Counts = {};
  for (const table of tables) {
    counts[table] = await safeScalar(sql, `select count(*) as value from ${qualify(table)}`);
  }
  counts[`${MIGRATIONS_TABLE.schema}.${MIGRATIONS_TABLE.name}`] = await safeScalar(
    sql,
    `select count(*) as value from ${qualify(MIGRATIONS_TABLE.name, MIGRATIONS_TABLE.schema)}`
  );
  return counts;
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

/** Liest eine Pflicht-Umgebungsvariable oder bricht mit klarer Meldung ab. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} ist nicht gesetzt.`);
  }
  return value.trim();
}
