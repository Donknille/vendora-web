/**
 * Guard vor `db:migrate` und `db:push`.
 *
 * Eine Schemaaenderung gegen Produktion ohne frisches, verifiziertes Backup ist
 * die eine Operation, die man nicht zurueckdrehen kann. Der Guard prueft in der
 * ZIELdatenbank, ob dort ein `backup_verified` juenger als 26 Stunden steht.
 *
 * Gegen localhost winkt er lautlos durch. Alles andere gilt als Produktion —
 * Vendora hat kein Staging, und die einzige sichere Fehlerrichtung ist
 * "Nachweis verlangen".
 *
 * Ist der Nachweis NICHT PRUEFBAR (Datenbank nicht erreichbar, Tabelle fehlt),
 * gilt er als nicht erbracht. Ein Guard, der bei Unsicherheit durchlaesst, ist
 * kein Guard.
 *
 * Notausgang: `npm run db:migrate:unsafe` / `npm run db:push:unsafe`.
 */
import { existsSync } from "node:fs";
import { classifyDbUrl } from "./dbUrlKind";
import { connect } from "./lib";
import { fail, info, isMain } from "./cli";

const MAX_AGE_HOURS = 26;

async function main(): Promise<void> {
  // drizzle-kit laedt .env.local selbst (siehe drizzle.config.ts). Der Guard
  // muss dieselbe Datei lesen, sonst prueft er eine andere Datenbank als die,
  // gegen die gleich migriert wird.
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const url = process.env.DATABASE_URL;
  const kind = classifyDbUrl(url);

  if (kind === "unparsable") {
    fail(
      "DATABASE_URL fehlt oder ist nicht parsebar. Ohne Ziel laesst sich nicht " +
        "pruefen, ob ein frisches Backup existiert."
    );
  }

  if (kind === "local") {
    info("Backup-Guard: lokale Datenbank — uebersprungen.");
    return;
  }

  const sql = connect(url as string);
  let ageHours: number | null = null;

  try {
    const rows = await sql<{ age_hours: string | null }[]>`
      select extract(epoch from (now() - max(occurred_at))) / 3600 as age_hours
        from backup_events
       where event_type = 'backup_verified'
    `;
    const raw = rows[0]?.age_hours;
    ageHours = raw === null || raw === undefined ? null : Number(raw);
  } catch (err) {
    fail([
      "Der Backup-Nachweis liess sich nicht pruefen: " +
        (err instanceof Error ? err.message : String(err)),
      "Nicht pruefbar heisst nicht erbracht. Abbruch.",
    ]);
  } finally {
    await sql.end({ timeout: 5 });
  }

  if (ageHours === null || !Number.isFinite(ageHours)) {
    fail([
      "In der Zieldatenbank steht kein einziges 'backup_verified'-Ereignis.",
      "Erst `npm run backup:now` fahren und den Lauf gruen abwarten.",
      "Bewusster Notausgang: `npm run db:migrate:unsafe`.",
    ]);
  }

  if (ageHours > MAX_AGE_HOURS) {
    fail([
      `Das letzte verifizierte Backup ist ${ageHours.toFixed(1)} Stunden alt ` +
        `(erlaubt: ${MAX_AGE_HOURS}).`,
      "Erst `npm run backup:now` fahren und den Lauf gruen abwarten.",
      "Bewusster Notausgang: `npm run db:migrate:unsafe`.",
    ]);
  }

  info(`Backup-Guard: letztes verifiziertes Backup vor ${ageHours.toFixed(1)} h — in Ordnung.`);
}

if (isMain(import.meta.url)) {
  main().catch((err: unknown) => {
    fail(`Backup-Guard fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  });
}
