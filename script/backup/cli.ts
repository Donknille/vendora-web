/**
 * Kleine Helfer fuer die Backup-Skripte unter script/backup/.
 *
 * Diese Dateien sind Kommandozeilenwerkzeuge: ihre Standardausgabe IST das
 * Produkt (sie landet im Actions-Log). Die Projektregel "kein console.log"
 * zielt auf den Anwendungscode unter src/ und gilt hier nicht.
 *
 * Bewusst frei von Abhaengigkeiten: dieses Modul wird auch von Skripten
 * importiert, die laufen muessen, bevor irgendetwas anderes bereitsteht.
 */
import { pathToFileURL } from "node:url";

const IN_ACTIONS = Boolean(process.env.GITHUB_ACTIONS);

/**
 * True, wenn das Modul direkt als Skript gestartet wurde (`tsx datei.ts`).
 * Unter Vitest zeigt argv[1] auf den Test-Runner, damit bleibt der Import
 * nebenwirkungsfrei — die reinen Pruef-Funktionen sind so testbar.
 */
export function isMain(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return metaUrl === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

export function info(message: string): void {
  console.log(message);
}

/** Warnung, die den Lauf gelb faerbt, aber nicht abbricht. */
export function warn(message: string): void {
  console.log(IN_ACTIONS ? `::warning::${message}` : `WARNUNG: ${message}`);
}

/** Fehler ins Log — ohne Abbruch, damit mehrere Befunde gesammelt ausgegeben werden. */
export function error(message: string): void {
  console.log(IN_ACTIONS ? `::error::${message}` : `FEHLER: ${message}`);
}

/** Bricht den Schritt ab. Sammelt vorher alle Befunde, statt beim ersten zu sterben. */
export function fail(messages: string | string[]): never {
  for (const message of Array.isArray(messages) ? messages : [messages]) {
    error(message);
  }
  process.exit(1);
}

/**
 * Schreibt `name=value` in $GITHUB_OUTPUT, damit spaetere Schritte den Wert
 * lesen koennen. Ausserhalb von Actions ein No-op.
 */
export async function setOutput(name: string, value: string): Promise<void> {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const { appendFile } = await import("node:fs/promises");
  // Mehrzeilige Werte brauchen die Heredoc-Form, sonst bricht die Datei.
  const delimiter = `ghadelim_${name}`;
  await appendFile(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8");
}
