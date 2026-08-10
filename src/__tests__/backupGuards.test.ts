import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkBackupUrl } from "../../script/backup/assert-backup-url";
import { classifyDbUrl, maskHost } from "../../script/backup/dbUrlKind";
import {
  CORE_TABLES,
  DATA_EXCLUDED_TABLES,
  MUST_NOT_BE_EMPTY,
  allTableNames,
  dataTableNames,
} from "../../script/backup/lib";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Guards fuer die Betriebssicherung (docs/backup-runbook.md). Der Restore-Drill
// selbst laeuft nur in GitHub Actions gegen echte Postgres-Instanzen; was hier
// steht, sind die Zusagen, die auch ohne Datenbank ueberpruefbar sind — und die
// stillschweigend brechen wuerden, wenn jemand das Schema erweitert.

describe("Tabellenlisten bleiben am Drizzle-Schema", () => {
  it("leitet die Tabellen aus dem Schema ab statt sie zu pflegen", () => {
    const tables = allTableNames();
    // Stichproben quer durch die Domaene, inkl. der Better-Auth-Tabellen.
    for (const name of ["users", "orders", "invoices", "user", "account", "backup_events"]) {
      expect(tables, `${name} fehlt in allTableNames()`).toContain(name);
    }
    expect(tables.length).toBeGreaterThanOrEqual(18);
  });

  it("kennt jede Tabelle, die MUST_NOT_BE_EMPTY und CORE_TABLES nennen", () => {
    // Ein Tippfehler in einer der Listen wuerde die Pruefung sonst lautlos
    // ueberspringen — der Waechter waere da, ohne zu wachen.
    const tables = new Set(allTableNames());
    for (const name of [...MUST_NOT_BE_EMPTY, ...CORE_TABLES, ...DATA_EXCLUDED_TABLES]) {
      expect(tables, `${name} steht in einer Backup-Liste, aber nicht im Schema`).toContain(name);
    }
  });

  it("nimmt die Passwort-Hashes mit und laesst nur Kurzlebiges weg", () => {
    // account traegt die Better-Auth-Passwort-Hashes. Die sind nicht
    // wiederbeschaffbar — genau deshalb muss das Archiv verschluesselt sein.
    expect(dataTableNames()).toContain("account");
    expect(dataTableNames()).not.toContain("session");
    expect(dataTableNames()).not.toContain("verification");
  });

  it("haelt an den Untergrenzen fest", () => {
    // Der Leerdump-Detektor. Bei Neon ist der realistische Ausloeser ein
    // falscher Branch: schema-identisch, leer, Dump laeuft sauber durch.
    // Wer diese Liste leert, entfernt die Sicherung.
    expect(MUST_NOT_BE_EMPTY.length).toBeGreaterThanOrEqual(3);
    expect(MUST_NOT_BE_EMPTY).toContain("user");
    expect(MUST_NOT_BE_EMPTY).toContain("users");
    expect(MUST_NOT_BE_EMPTY).toContain("account");
  });
});

describe("assert-backup-url weist die bekannten Fehlerformen ab", () => {
  const good =
    "postgresql://neondb_owner:s3cr3t@ep-tiny-mountain-as2f9l3u.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require";

  it("nimmt die richtige Neon-URI an", () => {
    expect(checkBackupUrl(good).problems).toEqual([]);
  });

  it("weist den Neon-Pooler ab", () => {
    // Das Vendora-Gegenstueck zu Port 6543 bei Supabase: pg_dump braucht
    // Session-State und scheitert ueber PgBouncer.
    const pooled = good.replace("ep-tiny-mountain-as2f9l3u", "ep-tiny-mountain-as2f9l3u-pooler");
    expect(checkBackupUrl(pooled).problems.join(" ")).toMatch(/-pooler/);
  });

  const cases: [string, string | undefined, RegExp][] = [
    ["nicht gesetzt", undefined, /nicht gesetzt/],
    ["leer", "", /nicht gesetzt|leer/],
    ["mit Zeilenumbruch", `${good}\n`, /Leerzeichen|Zeilenumbruch/],
    ["psql-Form mit Leerzeichen", "postgresql://a:b@host/db -p 5432", /Leerzeichen/],
    ["JDBC-Format", `jdbc:${good}`, /postgres:\/\//],
    ["ohne sslmode", good.replace("?sslmode=require", ""), /sslmode/],
    ["mit sslmode=disable", good.replace("require", "disable"), /sslmode=disable/],
    ["falscher Port", good.replace(".tech/", ".tech:6543/"), /6543/],
    ["Platzhalter-Passwort", good.replace("s3cr3t", "%5BYOUR-PASSWORD%5D"), /Platzhalter/],
    ["ohne Passwort", good.replace(":s3cr3t", ""), /kein Passwort/],
    ["auf localhost", "postgresql://u:p@localhost:5432/db?sslmode=require", /localhost/],
  ];

  for (const [label, value, expected] of cases) {
    it(`weist ab: ${label}`, () => {
      const { problems } = checkBackupUrl(value);
      expect(problems.length, `${label} wurde durchgewinkt`).toBeGreaterThan(0);
      expect(problems.join(" ")).toMatch(expected);
    });
  }

  it("gibt weder Passwort noch vollen Host aus", () => {
    const { summary } = checkBackupUrl(good);
    const rendered = JSON.stringify(summary);
    expect(rendered).not.toContain("s3cr3t");
    // Der eindeutige Endpunkt-Teil bleibt draussen: Actions-Logs sind in einem
    // oeffentlichen Repository fuer jeden lesbar.
    expect(rendered).not.toContain("as2f9l3u");
    expect(maskHost("ep-tiny-mountain-as2f9l3u.c-4.eu-central-1.aws.neon.tech")).toContain("****");
  });
});

describe("URL-Klassifizierung des db:migrate-Guards", () => {
  it("winkt lokale Datenbanken durch", () => {
    for (const url of [
      "postgresql://postgres:postgres@localhost:5432/vendora",
      "postgres://u:p@127.0.0.1:5432/db",
      "postgres://u:p@[::1]:5432/db",
    ]) {
      expect(classifyDbUrl(url)).toBe("local");
    }
  });

  it("behandelt alles Entfernte als Produktion", () => {
    // Vendora hat kein Staging. Die einzige sichere Fehlerrichtung ist
    // "Nachweis verlangen" — eine Heuristik auf Branch-Namen greift einmal
    // daneben, und dann gegen Produktion.
    expect(classifyDbUrl("postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/neondb")).toBe(
      "production"
    );
    expect(classifyDbUrl("postgresql://u:p@ep-dev-branch.aws.neon.tech/neondb")).toBe("production");
  });

  it("gilt bei Unlesbarkeit als nicht pruefbar", () => {
    expect(classifyDbUrl(undefined)).toBe("unparsable");
    expect(classifyDbUrl("   ")).toBe("unparsable");
    expect(classifyDbUrl("kein-url")).toBe("unparsable");
  });
});

describe("Verdrahtung der Pipeline", () => {
  const workflow = read(".github/workflows/backup.yml");
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

  it("faehrt Dump, Restore und Service-Container auf derselben Hauptversion", () => {
    // Ein 18er-Dump in eine 17er-Datenbank ist nicht unterstuetzt und kann
    // TEILWEISE durchlaufen — schlimmer als ein klarer Fehler. inventory.ts
    // prueft zur Laufzeit gegen PG_MAJOR; hier bleibt die YAML konsistent.
    expect(workflow).toContain("image: postgres:18");
    expect(workflow).toContain("PG_IMAGE: postgres:18-alpine");
    expect(workflow).toContain('PG_MAJOR: "18"');
  });

  it("prueft die Verbindungszeichenfolge vor allem anderen", () => {
    const assertAt = workflow.indexOf("assert-backup-url.ts");
    const dumpAt = workflow.indexOf('pg_dump "$PGURL"');
    expect(assertAt).toBeGreaterThan(-1);
    expect(dumpAt).toBeGreaterThan(-1);
    expect(assertAt).toBeLessThan(dumpAt);
  });

  it("laesst den Restore strikt scheitern", () => {
    expect(workflow).toContain("--exit-on-error");
    // Der TOC-Filter statt DROP SCHEMA: das Schema public traegt die Extensions.
    expect(workflow).toContain('grep -vE "SCHEMA - public([[:space:]]|$)"');
    expect(workflow).not.toContain("DROP SCHEMA");
    // Das Migrationsjournal darf der Filter nicht mitnehmen.
    expect(workflow).toContain("--schema=drizzle");
  });

  it("verifiziert vor dem Verschluesseln und kopiert offsite ohne sync", () => {
    expect(workflow.indexOf("verify-restore.ts")).toBeLessThan(workflow.indexOf("age -r"));
    expect(workflow).toContain("rclone copy");
    // sync/purge wuerde eine lokale Fehl-Loeschung in die Cloud fortpflanzen.
    expect(workflow).not.toMatch(/rclone (sync|purge)/);
    expect(workflow).toContain("--min-age 90d");
  });

  it("laesst nur Verschluesseltes ins oeffentliche Artifact", () => {
    expect(workflow).toContain("! -name '*.age' ! -name '*.sha256'");
    expect(workflow).toContain("rm -f \"out/vendora-$STAMP.tar.gz\"");
  });

  it("nennt in der Ergebniszeile den Datenstand, nicht nur OK", () => {
    // Ein eingefrorenes Backup faellt sonst erst nach Tagen auf.
    const line = workflow.slice(workflow.indexOf("echo \"OK: vendora-"));
    expect(line).toContain("canary=");
    expect(line).toContain("Stand=");
    expect(line).toContain("sha256=");
  });

  it("haengt den Guard vor beide Wege in die Produktionsdatenbank", () => {
    expect(pkg.scripts["db:migrate"]).toContain("assert-fresh-backup.ts");
    expect(pkg.scripts["db:push"]).toContain("assert-fresh-backup.ts");
    // Der Notausgang existiert und heisst bewusst so.
    expect(pkg.scripts["db:migrate:unsafe"]).toBe("drizzle-kit migrate");
    expect(pkg.scripts["db:push:unsafe"]).toBe("drizzle-kit push");
  });

  it("laeuft vor dem mutierenden Vercel-Cron", () => {
    // Dann ist ein fehlerhafter Cron-Lauf aus dem Backup desselben Morgens
    // rekonstruierbar.
    const crons = JSON.parse(read("vercel.json")) as { crons: { schedule: string }[] };
    const backupHour = Number(workflow.match(/cron: "(\d+) (\d+) \* \* \*"/)![2]);
    for (const cron of crons.crons) {
      expect(backupHour).toBeLessThan(Number(cron.schedule.split(" ")[1]));
    }
  });
});

describe("Backup-Skripte haengen nicht an der App-Bootstrap-Validierung", () => {
  // Im Runner gibt es weder "server-only" noch die validierte Server-Env. Ein
  // Import aus src/lib/server/* wuerde die Pipeline daran scheitern lassen —
  // und zwar erst zur Laufzeit, mitten in der Nacht.
  const scripts = [
    "lib.ts",
    "cli.ts",
    "dbUrlKind.ts",
    "inventory.ts",
    "prepare-snapshot.ts",
    "verify-restore.ts",
    "notify-failure.ts",
    "assert-backup-url.ts",
    "assert-fresh-backup.ts",
    "trigger-backup.ts",
  ];

  for (const file of scripts) {
    it(`${file} importiert nichts aus src/lib/server ausser dem Schema`, () => {
      const source = read(path.join("script", "backup", file));
      const imports = [...source.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
      const forbidden = imports.filter(
        (spec) =>
          (spec.includes("lib/server") || spec.startsWith("@/")) &&
          !spec.endsWith("lib/server/schema")
      );
      expect(forbidden, `verbotene Importe in ${file}`).toEqual([]);
    });
  }
});
