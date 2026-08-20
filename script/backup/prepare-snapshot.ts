/**
 * Misst die Produktionsdatenbank rund um den Dump herum.
 *
 *   --phase pre   Canary schreiben, dann Zeilenzahlen UND JSON-Export je
 *                 Tabelle in einer konsistenten Sicht.
 *   --phase post  Zeilenzahlen erneut.
 *
 * Warum zwei Messungen: pg_dump nimmt seinen MVCC-Snapshot irgendwo dazwischen.
 * Die wiederhergestellte Zeilenzahl muss deshalb im Band
 * [min(pre,post), max(pre,post)] liegen. Ein starrer Vergleich gegen einen
 * einzelnen Messpunkt schluege bei einem einzigen naechtlichen Schreibvorgang
 * falschen Alarm — und ein Waechter, der grundlos anschlaegt, wird abgeschaltet.
 *
 * Warum der Canary VOR dem Dump geschrieben und committet wird: nur dann muss
 * er im Dump enthalten sein. Fehlt er spaeter in der Kopie, wurde eine andere
 * Datenbank gesichert (bei Neon: der falsche Branch) oder der Dump ist
 * abgeschnitten.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  DATA_EXCLUDED_TABLES,
  allTableNames,
  collectCounts,
  connect,
  dataTableNames,
  requireEnv,
  writeJson,
} from "./lib";
import { fail, info, isMain } from "./cli";

const WORK_DIR = process.env.BACKUP_WORK_DIR ?? "work";

function parsePhase(argv: string[]): "pre" | "post" {
  const index = argv.indexOf("--phase");
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value !== "pre" && value !== "post") {
    fail("Aufruf: prepare-snapshot.ts --phase pre|post");
  }
  return value;
}

async function main(): Promise<void> {
  const phase = parsePhase(process.argv.slice(2));
  const sql = connect(requireEnv("BACKUP_DATABASE_URL"));

  try {
    if (phase === "post") {
      const counts = await collectCounts(sql, allTableNames());
      await writeJson(path.join(WORK_DIR, "counts-post.json"), counts);
      info(`Zeilenzahlen (post) fuer ${Object.keys(counts).length} Tabellen erfasst.`);
      return;
    }

    // --- Canary ------------------------------------------------------------
    const token = randomUUID();
    await sql`
      insert into backup_events (event_type, token, payload)
      values ('backup_canary', ${token}, ${sql.json({
        runUrl: process.env.BACKUP_RUN_URL ?? null,
        reason: process.env.BACKUP_REASON ?? "schedule",
      })})
    `;
    info(`Canary geschrieben: ${token}`);

    // --- Konsistente Sicht -------------------------------------------------
    const tables = dataTableNames();
    const counts = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const snapshot = await collectCounts(tx, allTableNames());

        for (const table of tables) {
          const rows = await tx.unsafe(`select * from "public"."${table}"`);
          await writeJson(path.join(WORK_DIR, "json", `${table}.json`), rows);
        }

        return snapshot;
      }
    );

    await writeJson(path.join(WORK_DIR, "counts-pre.json"), counts);
    await writeJson(path.join(WORK_DIR, "canary.json"), { token });
    await writeJson(path.join(WORK_DIR, "manifest.json"), {
      // Der JSON-Export ist der Notausgang, falls das Binaerformat des Dumps
      // beschaedigt ist. Er muss deshalb sagen, was er NICHT enthaelt.
      // Traegt weiter den alten Namen, wie die ganze Pipeline: Archive,
      // Dump-Datei und Drive-Ordner heissen seit jeher vendora-*, und
      // bestehende Staende muessen lesbar bleiben.
      generatedBy: "vendora backup pipeline",
      runUrl: process.env.BACKUP_RUN_URL ?? null,
      jsonTables: tables,
      tablesWithoutData: [...DATA_EXCLUDED_TABLES],
      note:
        "session/verification sind bewusst ohne Daten gesichert (Schema ja, Zeilen nein). " +
        "Nach einem Restore muessen sich alle Nutzer neu anmelden. " +
        "Passwort-Hashes liegen in 'account' und sind enthalten.",
    });

    info(
      `Zeilenzahlen (pre) erfasst, JSON-Export fuer ${tables.length} Tabellen ` +
        `geschrieben nach ${path.join(WORK_DIR, "json")}.`
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (isMain(import.meta.url)) {
  main().catch((err: unknown) => {
    fail(`Snapshot fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  });
}
