/**
 * Der Restore-Drill — das Herzstueck der Pipeline.
 *
 * Ein Backup, das nie wiederhergestellt wurde, ist kein Backup, sondern eine
 * Annahme. Deshalb laeuft dieser Schritt bei JEDEM Lauf und nicht monatlich,
 * und deshalb ist pg_restore davor mit --exit-on-error gefahren: ein Drill, der
 * Fehler durchwinkt, beweist nichts.
 *
 * Sechs Pruefungen. Jede rote setzt den Lauf auf rot. Es gibt KEINEN Pfad, auf
 * dem "OK" im Log landet, obwohl etwas nicht stimmte.
 *
 * Bei Erfolg wird `backup_verified` in die PRODUKTIONSdatenbank geschrieben —
 * nicht in eine Datei. Dieser Nachweis muss GitHub ueberleben: der App-Waechter
 * (36-h-Alarm) und der Guard vor db:migrate/db:push stuetzen sich darauf.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Sql } from "postgres";
import {
  ANOMALY_DROP_MIN_ROWS,
  ANOMALY_DROP_RATIO,
  CORE_TABLES,
  DATA_EXCLUDED_TABLES,
  MIGRATIONS_TABLE,
  MUST_NOT_BE_EMPTY,
  type Counts,
  allTableNames,
  collectCounts,
  connect,
  requireEnv,
  safeScalar,
  writeJson,
} from "./lib";
import { fail, info, isMain, setOutput } from "./cli";

const WORK_DIR = process.env.BACKUP_WORK_DIR ?? "work";

const ORPHAN_CHECKS: { label: string; query: string }[] = [
  {
    label: "order_items ohne Auftrag",
    query: `select count(*) as value from order_items oi
              left join orders o on o.id = oi.order_id
             where o.id is null`,
  },
  {
    label: "market_sales ohne Markt",
    query: `select count(*) as value from market_sales ms
              left join market_events m on m.id = ms.market_id
             where m.id is null`,
  },
  {
    label: "abgeleitete Ausgaben ohne Markt",
    query: `select count(*) as value from expenses
             where source <> 'manual' and market_id is null`,
  },
  {
    label: "Rechnungen mit Nutzerbezug, aber ohne Nutzer",
    query: `select count(*) as value from invoices i
              left join users u on u.id = i.user_id
             where i.user_id is not null and u.id is null`,
  },
];

async function readCounts(file: string): Promise<Counts> {
  return JSON.parse(await readFile(path.join(WORK_DIR, file), "utf8")) as Counts;
}

/** Zeilenzahlen des letzten bestandenen Laufs — Grundlage des Anomalie-Waechters. */
async function lastVerifiedCounts(prod: Sql): Promise<Counts | null> {
  const rows = await prod<{ payload: { counts?: Counts } | null }[]>`
    select payload from backup_events
     where event_type = 'backup_verified'
     order by occurred_at desc
     limit 1
  `;
  return rows[0]?.payload?.counts ?? null;
}

async function main(): Promise<void> {
  const restore = connect(requireEnv("RESTORE_DATABASE_URL"));
  const prod = connect(requireEnv("BACKUP_DATABASE_URL"));
  const problems: string[] = [];

  try {
    const pre = await readCounts("counts-pre.json");
    const post = await readCounts("counts-post.json");
    const { token } = JSON.parse(
      await readFile(path.join(WORK_DIR, "canary.json"), "utf8")
    ) as { token: string };

    const tables = allTableNames();
    const restored = await collectCounts(restore, tables);
    const excluded = new Set<string>(DATA_EXCLUDED_TABLES);

    // --- 1. Alle Tabellen vorhanden ----------------------------------------
    const missing = Object.entries(restored)
      .filter(([, value]) => value === null)
      .map(([name]) => name);
    if (missing.length > 0) {
      problems.push(
        `Nicht lesbar in der Wiederherstellung: ${missing.join(", ")}. ` +
          "Entweder fehlt die Tabelle im Dump oder pg_restore ist unvollstaendig " +
          "durchgelaufen."
      );
    }

    // --- 2. Zeilenzahlen im Band [pre, post] -------------------------------
    for (const table of tables) {
      const actual = restored[table];
      if (actual === null || actual === undefined) continue; // schon unter 1. gemeldet

      if (excluded.has(table)) {
        if (actual !== 0) {
          problems.push(
            `${table} sollte ohne Daten gesichert sein, enthaelt aber ${actual} Zeilen. ` +
              "--exclude-table-data in backup.yml pruefen."
          );
        }
        continue;
      }

      const a = pre[table];
      const b = post[table];
      if (a === null || a === undefined || b === null || b === undefined) {
        problems.push(`Fuer ${table} fehlt eine Vergleichsmessung (pre/post).`);
        continue;
      }

      const low = Math.min(a, b);
      const high = Math.max(a, b);
      if (actual < low || actual > high) {
        problems.push(
          `${table}: ${actual} Zeilen wiederhergestellt, erwartet ${low}..${high} ` +
            `(pre=${a}, post=${b}).`
        );
      }
    }

    // collectCounts zaehlt das Migrationsjournal bereits mit — es liegt nur in
    // einem anderen Schema und faellt deshalb aus der Schleife oben heraus.
    const migrationsKey = `${MIGRATIONS_TABLE.schema}.${MIGRATIONS_TABLE.name}`;
    const migrations = restored[migrationsKey] ?? null;

    // --- 3. Untergrenzen ---------------------------------------------------
    // Faengt "Quelle und Kopie sind beide 0, der Vergleich passt formal" — bei
    // Neon der falsche Branch: schema-identisch, leer, Dump laeuft sauber durch.
    for (const table of [...MUST_NOT_BE_EMPTY]) {
      const actual = restored[table];
      if (actual === null || actual === undefined || actual < 1) {
        problems.push(
          `${table} ist in der Wiederherstellung leer (${actual ?? "nicht lesbar"}). ` +
            "In einer lebenden Vendora-Datenbank kann das nicht sein — sehr " +
            "wahrscheinlich zeigt BACKUP_DATABASE_URL auf den falschen Neon-Branch."
        );
      }
    }
    if (migrations === null || migrations < 1) {
      problems.push(
        `${migrationsKey} ist leer oder fehlt. Ohne das Migrationsjournal weiss eine ` +
          "wiederhergestellte Datenbank nicht, welche Migrationen liefen."
      );
    }

    // --- 4. Canary ---------------------------------------------------------
    const canary = await safeScalar(
      restore,
      `select count(*) as value from backup_events where token = '${token.replace(/'/g, "''")}'`
    );
    const canaryOk = canary === 1;
    if (!canaryOk) {
      problems.push(
        `Canary ${token} in der Wiederherstellung nicht gefunden (${canary ?? "nicht lesbar"} ` +
          "Treffer). Es wurde eine andere Datenbank gesichert oder der Dump ist " +
          "abgeschnitten."
      );
    }

    // --- 5. Referenzielle Stichprobe ---------------------------------------
    for (const check of ORPHAN_CHECKS) {
      const orphans = await safeScalar(restore, check.query);
      if (orphans === null) {
        problems.push(`Stichprobe "${check.label}" liess sich nicht ausfuehren.`);
      } else if (orphans > 0) {
        problems.push(`Stichprobe "${check.label}": ${orphans} Waisen in der Kopie.`);
      }
    }

    // --- 6. Anomalie-Waechter ----------------------------------------------
    // Der einzige Detektor fuer stillen Verlust: die Kopie stimmt mit der
    // Quelle ueberein, aber die Quelle hat ueber Nacht Daten verloren.
    const previous = await lastVerifiedCounts(prod);
    if (previous === null) {
      info("Anomalie-Waechter: kein frueherer verifizierter Lauf — erster Vergleich faellt aus.");
    } else {
      for (const table of [...CORE_TABLES]) {
        const before = previous[table];
        const now = pre[table];
        if (before === null || before === undefined || now === null || now === undefined) continue;

        const drop = before - now;
        if (drop >= ANOMALY_DROP_MIN_ROWS && drop > before * ANOMALY_DROP_RATIO) {
          problems.push(
            `${table} ist von ${before} auf ${now} Zeilen gefallen (-${drop}). Das ist mehr ` +
              `als ${Math.round(ANOMALY_DROP_RATIO * 100)} % seit dem letzten verifizierten ` +
              "Backup. Wenn der Verlust gewollt war, den Lauf erneut starten — sonst ist " +
              "genau jetzt der Moment fuer eine Wiederherstellung."
          );
        }
      }
    }

    // --- Ergebnis ----------------------------------------------------------
    const stand = [...MUST_NOT_BE_EMPTY, ...CORE_TABLES]
      .map((table) => `${table}=${restored[table] ?? "?"}`)
      .join(", ");

    await writeJson(path.join(WORK_DIR, "verify-report.json"), {
      canary: canaryOk ? "ok" : "fehlt",
      counts: restored,
      countsPre: pre,
      countsPost: post,
      problems,
    });

    if (problems.length > 0) fail(problems);

    await prod`
      insert into backup_events (event_type, payload)
      values ('backup_verified', ${prod.json({
        counts: restored,
        canary: "ok",
        runUrl: process.env.BACKUP_RUN_URL ?? null,
        checks: [
          "tabellen-vollstaendig",
          "zeilenzahlen-im-band",
          "untergrenzen",
          "canary",
          "referenzielle-stichprobe",
          "anomalie-waechter",
        ],
      })})
    `;

    await setOutput("stand", stand);
    await setOutput("canary", "ok");
    info(`OK: Restore-Drill bestanden. canary=ok, Stand=${stand}`);
  } finally {
    await restore.end({ timeout: 5 });
    await prod.end({ timeout: 5 });
  }
}

if (isMain(import.meta.url)) {
  main().catch((err: unknown) => {
    fail(`Restore-Drill fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  });
}
