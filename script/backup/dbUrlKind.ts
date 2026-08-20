/**
 * Klassifiziert eine Postgres-Verbindungs-URL nach ihrem Blast-Radius.
 *
 * Bewusst ein eigenes, DB-freies Modul: der Guard vor `db:migrate`/`db:push`
 * haengt an dieser Entscheidung, und sie muss ohne Netz und ohne Secrets
 * testbar sein (src/__tests__/backupGuards.test.ts).
 *
 * Die Regel ist absichtlich grob: **alles ausser localhost gilt als
 * Produktion.** Bilanz-Buddy hat kein Staging, und die einzige sichere
 * Fehlerrichtung ist "Nachweis verlangen". Eine Heuristik, die Neon-Branches
 * nach Namen zu unterscheiden versucht, waere genau die Art von Klugheit, die
 * einmal danebengreift — und dann gegen die Produktionsdatenbank.
 */
export type DbUrlKind = "local" | "production" | "unparsable";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
]);

export function classifyDbUrl(raw: string | undefined | null): DbUrlKind {
  if (!raw || !raw.trim()) return "unparsable";

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "unparsable";
  }

  if (!url.hostname) return "unparsable";
  // IPv6-Hosts kommen mit Klammern aus dem Parser: [::1] -> ::1
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return LOCAL_HOSTS.has(host) ? "local" : "production";
}

/**
 * Kuerzt einen Hostnamen fuer die Ausgabe, damit vollstaendige Endpunkte nicht
 * in oeffentlich lesbaren GitHub-Action-Logs landen (das Repo ist public).
 *
 *   ep-tiny-mountain-as2f9l3u.c-4.eu-central-1.aws.neon.tech
 *   -> ep-tiny-****.c-4.eu-central-1.aws.neon.tech
 */
export function maskHost(hostname: string): string {
  const [first, ...rest] = hostname.split(".");
  if (!first) return hostname;

  const keep = first.split("-").slice(0, 3).join("-");
  const masked = keep.length < first.length ? `${keep}-****` : first;
  return [masked, ...rest].join(".");
}
