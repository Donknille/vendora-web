/**
 * Prueft die FORM von BACKUP_DATABASE_URL, bevor irgendetwas Teures laeuft.
 *
 * Laeuft als allererster DB-Schritt des Backup-Workflows. Bei Meisterplaner
 * zeigte das Secret auf den Transaction Pooler; das Fehlerbild war
 * "connection to server on socket .s.PGSQL.5432 failed" — sah nach einer
 * kaputten LOKALEN Datenbank aus und hatte mit der Ursache nichts zu tun. Der
 * Schritt davor lief durch, weil node-postgres nachsichtiger parst als libpq.
 * Drei Tage Suche fuer eine Ziffer im Hostnamen.
 *
 * Der Wert wird NIE ausgegeben, auch nicht in Teilen. GitHub maskiert Secrets
 * zwar, darauf verlaesst sich dieses Skript bewusst nicht — und weil
 * Donknille/vendora-web ein oeffentliches Repo ist, sind die Logs fuer jeden
 * lesbar. Deshalb ist auch der Host maskiert und die Passwortlaenge fehlt.
 */
import { classifyDbUrl, maskHost } from "./dbUrlKind";
import { fail, info, isMain } from "./cli";

export interface UrlCheckResult {
  problems: string[];
  /** Nur gesetzt, wenn die URL parsebar war. Enthaelt keine Geheimnisse. */
  summary?: {
    scheme: string;
    host: string;
    port: string;
    database: string;
    user: string;
    params: string;
  };
}

const PLACEHOLDERS = ["[your-password]", "your-password", "password", "<password>"];

export function checkBackupUrl(raw: string | undefined): UrlCheckResult {
  const problems: string[] = [];

  if (raw === undefined || raw === "") {
    return { problems: ["BACKUP_DATABASE_URL ist nicht gesetzt oder leer."] };
  }

  const trimmed = raw.trim();
  if (trimmed !== raw) {
    problems.push(
      "BACKUP_DATABASE_URL hat fuehrende oder abschliessende Leerzeichen bzw. einen " +
        "Zeilenumbruch. Das ist der haeufigste Copy-Paste-Unfall — Secret ohne " +
        "Umbruch neu setzen."
    );
  }

  if (/\s/.test(trimmed)) {
    problems.push(
      "BACKUP_DATABASE_URL enthaelt Leerzeichen im Wert. Das ist die " +
        "`psql -h ... -U ...`-Variante aus der Neon-Konsole; gebraucht wird die " +
        "URI-Form (Neon-Konsole -> Connection string)."
    );
  }

  if (!/^postgres(ql)?:\/\//i.test(trimmed)) {
    problems.push(
      "BACKUP_DATABASE_URL beginnt nicht mit postgres:// oder postgresql:// " +
        "(JDBC-, .NET- oder psql-Format erwischt)."
    );
    // Ohne gueltiges Schema ist jede weitere Aussage geraten.
    return { problems };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    problems.push(
      "BACKUP_DATABASE_URL ist nicht als URL parsebar. Fast immer ein nicht " +
        "kodiertes Sonderzeichen im Passwort: # -> %23, @ -> %40, / -> %2F, " +
        "? -> %3F, & -> %26."
    );
    return { problems };
  }

  if (!url.hostname) {
    problems.push(
      "BACKUP_DATABASE_URL hat keinen Host. Ein nicht kodiertes # schneidet die " +
        "URL ab; pg_dump faellt dann auf einen lokalen Socket zurueck und meldet " +
        "einen Fehler, der wie eine kaputte lokale Datenbank aussieht."
    );
    return { problems };
  }

  // --- Neon-spezifisch -----------------------------------------------------

  if (url.hostname.includes("-pooler")) {
    problems.push(
      "BACKUP_DATABASE_URL zeigt auf den Neon-Pooler (Host enthaelt '-pooler'). " +
        "pg_dump braucht Session-State und scheitert ueber PgBouncer; Neon " +
        "empfiehlt dafuer ausdruecklich die unpooled Verbindung. In der " +
        "Neon-Konsole 'Connection pooling' abwaehlen."
    );
  }

  if (url.port && url.port !== "5432") {
    problems.push(
      `BACKUP_DATABASE_URL nutzt Port ${url.port}. Neon bedient nur 5432 — ` +
        "Port weglassen oder auf 5432 setzen."
    );
  }

  const params = url.searchParams;
  const sslmode = params.get("sslmode");
  if (!sslmode) {
    problems.push(
      "BACKUP_DATABASE_URL hat kein sslmode. Neon verlangt TLS; " +
        "'?sslmode=require' anhaengen."
    );
  } else if (sslmode === "disable" || sslmode === "allow" || sslmode === "prefer") {
    problems.push(
      `BACKUP_DATABASE_URL hat sslmode=${sslmode}. Das erlaubt eine unverschluesselte ` +
        "Verbindung zur Produktionsdatenbank — 'require' oder strenger verwenden."
    );
  }

  // --- Zugangsdaten --------------------------------------------------------

  const password = decodeURIComponent(url.password || "");
  if (!password) {
    problems.push("BACKUP_DATABASE_URL enthaelt kein Passwort.");
  } else if (PLACEHOLDERS.includes(password.toLowerCase())) {
    problems.push(
      "BACKUP_DATABASE_URL enthaelt noch den Passwort-Platzhalter aus der Vorlage."
    );
  }

  if (!url.username) {
    problems.push("BACKUP_DATABASE_URL enthaelt keinen Benutzernamen.");
  }

  const database = url.pathname.replace(/^\//, "");
  if (!database) {
    problems.push("BACKUP_DATABASE_URL nennt keinen Datenbanknamen.");
  }

  if (classifyDbUrl(trimmed) === "local") {
    problems.push(
      "BACKUP_DATABASE_URL zeigt auf localhost. Der Workflow wuerde damit eine " +
        "leere Runner-Datenbank sichern und gruen melden."
    );
  }

  return {
    problems,
    summary: {
      scheme: url.protocol.replace(":", ""),
      host: maskHost(url.hostname),
      port: url.port || "(Standard 5432)",
      database: database || "(fehlt)",
      user: url.username ? `${url.username.slice(0, 4)}…` : "(fehlt)",
      params: params.toString() || "(keine)",
    },
  };
}

function main(): void {
  const { problems, summary } = checkBackupUrl(process.env.BACKUP_DATABASE_URL);

  if (summary) {
    info("BACKUP_DATABASE_URL (Form geprueft, Wert wird nicht ausgegeben):");
    info(`  Schema      : ${summary.scheme}`);
    info(`  Host        : ${summary.host}`);
    info(`  Port        : ${summary.port}`);
    info(`  Datenbank   : ${summary.database}`);
    info(`  Benutzer    : ${summary.user}`);
    info(`  Parameter   : ${summary.params}`);
    info("  Passwort    : vorhanden");
  }

  if (problems.length > 0) fail(problems);

  info("OK: BACKUP_DATABASE_URL hat die erwartete Form.");
}

if (isMain(import.meta.url)) main();
