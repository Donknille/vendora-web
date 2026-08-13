import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Gemeinsame Grundlage der Quelltext-Guards.
 *
 * Mehrere Architekturregeln dieses Projekts lassen sich nicht zur Laufzeit
 * pruefen — dass niemand `useQuery` direkt aufruft, dass Admin-Routen nicht an
 * `adminData` vorbeigreifen, dass die Marktkosten-Schreiber einen Status
 * durchreichen. Solche Regeln werden hier ueber den Quelltext geprueft.
 *
 * Der gefaehrliche Fehlerfall dabei ist nicht der rote Guard, sondern der
 * gruene, der nichts mehr bewacht: eine hartkodierte Dateiliste, deren Ziel
 * inzwischen woanders liegt, laeuft leer durch und meldet Erfolg. Genau das
 * war hier der Fall — `Sidebar.tsx` ruft `useQuery` direkt auf und stand in
 * keiner der Listen.
 *
 * Deshalb gilt fuer alles hier: nicht gefunden heisst laut scheitern, nie
 * still bestehen.
 */

export const ROOT = process.cwd();
export const SRC = path.join(ROOT, "src");

const SOURCE_EXTENSIONS = [".ts", ".tsx"];

/** Verzeichnisse, die kein Produktcode sind und deshalb nie mitgescannt werden. */
const NON_PRODUCT_DIRS = new Set(["__tests__", "test-utils", "node_modules"]);

/**
 * Alle Quelldateien unterhalb von `dir`, rekursiv und alphabetisch sortiert
 * (damit verkettete Ergebnisse reproduzierbar sind).
 */
export function collectSourceFiles(
  dir: string,
  opts: { includeNonProduct?: boolean } = {}
): string[] {
  if (!existsSync(dir)) {
    throw new Error(
      `Quelltext-Guard: Verzeichnis ${rel(dir)} existiert nicht. ` +
        `Wurde es verschoben? Guard anpassen, statt ihn leerlaufen zu lassen.`
    );
  }
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    if (!opts.includeNonProduct && NON_PRODUCT_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full, opts));
    } else if (SOURCE_EXTENSIONS.some((e) => full.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

/** Absoluten Pfad auf eine repo-relative, plattformneutrale Schreibweise bringen. */
export function rel(abs: string): string {
  return path.relative(ROOT, abs).replace(/\\/g, "/");
}

/**
 * Eine einzelne Quelldatei, relativ zu `src/`.
 *
 * Wirft mit klarer Ansage, wenn es sie nicht mehr gibt — ein Guard, dessen
 * Zieldatei verschwunden ist, muss rot werden.
 */
export function readSource(relToSrc: string): string {
  const full = path.join(SRC, relToSrc);
  if (!existsSync(full)) {
    throw new Error(
      `Quelltext-Guard: src/${relToSrc} existiert nicht (mehr). ` +
        `Nach einer Verschiebung den Guard mitziehen — nicht die Zeile loeschen.`
    );
  }
  return readFileSync(full, "utf8");
}

/**
 * Eine logische Einheit, egal ob sie heute eine Datei oder ein Verzeichnis ist.
 *
 * `readUnit("lib/server/storage")` liefert `storage.ts`, solange es die eine
 * Datei ist, und den verketteten Inhalt von `storage/`, sobald sie aufgeteilt
 * wurde. `readUnit("app/(app)/dashboard")` liefert `page.tsx` samt allem, was
 * spaeter in `_components/` daneben liegt.
 *
 * Das ist der Punkt: Ein Guard soll eine *Regel* bewachen, nicht einen
 * Dateipfad. Aufteilen darf ihn nicht blind machen.
 */
export function readUnit(relToSrc: string): string {
  const base = path.join(SRC, relToSrc);

  for (const ext of SOURCE_EXTENSIONS) {
    const asFile = `${base}${ext}`;
    if (existsSync(asFile) && statSync(asFile).isFile()) {
      return readFileSync(asFile, "utf8");
    }
  }

  if (existsSync(base) && statSync(base).isDirectory()) {
    const files = collectSourceFiles(base);
    if (files.length === 0) {
      throw new Error(
        `Quelltext-Guard: src/${relToSrc}/ enthaelt keine Quelldateien. ` +
          `Ein leerer Scan darf nicht als bestanden gelten.`
      );
    }
    return files.map((f) => `// ── ${rel(f)}\n${readFileSync(f, "utf8")}`).join("\n");
  }

  throw new Error(
    `Quelltext-Guard: src/${relToSrc} gibt es weder als Datei noch als ` +
      `Verzeichnis. Nach einer Verschiebung den Guard mitziehen.`
  );
}

/** Alle Quelldateien des Produktcodes unter `src/` (ohne Tests und Test-Helfer). */
export function collectProductSources(): string[] {
  return collectSourceFiles(SRC);
}

/**
 * Eine Route als Einheit: ihre `page.tsx` plus alles, was in ihrem eigenen
 * `_components/` liegt — aber ausdruecklich **keine** Unterrouten.
 *
 * `readUnit` waere hier zu grob: `app/(app)/orders` enthaelt auch `new/` und
 * `[id]/`, und ein Guard, der alles zusammenwirft, bliebe gruen, wenn die
 * Listenseite ihre Fehlerbehandlung verliert und die Detailseite sie behaelt.
 *
 * Mit `_components/` im Blick uebersteht der Guard aber das Zerlegen einer
 * grossen Seite in Abschnitte — die Regel wandert dann mit dem Code.
 */
export function readRoute(routeRelToSrc: string): string {
  const dir = path.join(SRC, routeRelToSrc);
  const page = path.join(dir, "page.tsx");
  if (!existsSync(page)) {
    throw new Error(
      `Quelltext-Guard: src/${routeRelToSrc}/page.tsx existiert nicht (mehr). ` +
        `Nach einer Verschiebung den Guard mitziehen.`
    );
  }
  const parts = [`// ── ${rel(page)}\n${readFileSync(page, "utf8")}`];

  const components = path.join(dir, "_components");
  if (existsSync(components) && statSync(components).isDirectory()) {
    for (const f of collectSourceFiles(components)) {
      parts.push(`// ── ${rel(f)}\n${readFileSync(f, "utf8")}`);
    }
  }
  return parts.join("\n");
}
