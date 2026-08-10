/**
 * `npm run backup:now` — stoesst den Backup-Workflow von Hand an.
 *
 * Gebraucht vor jeder Prod-Migration (der Guard in assert-fresh-backup.ts
 * verlangt einen Nachweis juenger als 26 h) und nach jeder Aenderung an der
 * Pipeline: **Merge zaehlt nicht, der erste gruene Lauf zaehlt.**
 */
import { spawnSync } from "node:child_process";
import { fail, info, isMain } from "./cli";

const WORKFLOW = "backup.yml";

function main(): void {
  const reason = process.argv.slice(2).join(" ") || "manual";

  const probe = spawnSync("gh", ["--version"], { encoding: "utf8", shell: true });
  if (probe.status !== 0) {
    fail([
      "Die GitHub-CLI (`gh`) ist nicht verfuegbar oder nicht angemeldet.",
      "Alternativ im Browser: Actions -> Backup -> Run workflow.",
    ]);
  }

  const run = spawnSync(
    "gh",
    ["workflow", "run", WORKFLOW, "-f", `reason=${reason}`],
    { encoding: "utf8", shell: true, stdio: "inherit" }
  );
  if (run.status !== 0) {
    fail(`\`gh workflow run ${WORKFLOW}\` ist mit Code ${run.status} abgebrochen.`);
  }

  info("");
  info(`Backup-Lauf angestossen (Grund: ${reason}).`);
  info("Fortschritt:  gh run watch");
  info("Letzter Lauf: gh run list --workflow=backup.yml --limit 1");
  info("");
  info(
    "Erst wenn der Lauf gruen ist und die Ergebniszeile den Datenstand nennt, " +
      "existiert ein neuer Nachweis."
  );
}

if (isMain(import.meta.url)) main();
