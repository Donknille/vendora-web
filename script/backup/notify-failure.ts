/**
 * Zweite Alarmstufe: eigene SMTP-Mail, wenn der Backup-Lauf scheitert.
 *
 * Bewusst ueber DENSELBEN Transport, der im Normalbetrieb taeglich
 * Bestaetigungs- und Reset-Mails zustellt (Strato). Ein Monitoring-Pfad, der
 * nur im Notfall benutzt wird, ist im Notfall kaputt.
 *
 * Kein Import von src/lib/server/email.ts: das Modul haengt an "server-only"
 * und der Zod-Env-Validierung der App. Hier laeuft nichts davon.
 *
 * Das Versandergebnis wird selbst geprueft. Ein Alarm, der nicht rausging, darf
 * keine blosse Log-Zeile sein — genau daran ist die Alarmierung bei
 * Meisterplaner monatelang lautlos vorbeigelaufen.
 */
import nodemailer from "nodemailer";
import { fail, info, isMain } from "./cli";

const IS_TEST = process.env.BACKUP_ALARM_TEST === "1";

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    fail(
      `${name} ist nicht gesetzt — die Alarmierung kann nicht zustellen. ` +
        "Secret in GitHub -> Settings -> Secrets -> Actions nachtragen."
    );
  }
  return value.trim();
}

function buildBody(): { subject: string; text: string } {
  const repo = process.env.GITHUB_REPOSITORY ?? "(unbekannt)";
  const runUrl = process.env.BACKUP_RUN_URL ?? "(keine Run-URL)";
  const reason = process.env.BACKUP_REASON ?? "schedule";

  if (IS_TEST) {
    return {
      subject: "[TEST] Vendora Backup — Alarmkette",
      text: [
        "Dies ist ein Test der Alarmkette. Es ist nichts kaputt.",
        "",
        "Wenn diese Mail im Postfach liegt (nicht im Spam), sind SMTP-Secrets,",
        "ALERT_EMAIL_TO und der Versandweg nachweislich in Ordnung.",
        "",
        `Repository: ${repo}`,
        `Lauf:       ${runUrl}`,
        "",
        "Ergebnis im Protokoll in docs/backup-runbook.md eintragen.",
      ].join("\n"),
    };
  }

  return {
    subject: "FEHLGESCHLAGEN: Vendora Backup",
    text: [
      "Der naechtliche Backup-Lauf ist fehlgeschlagen.",
      "",
      `Repository: ${repo}`,
      `Ausloeser:  ${reason}`,
      `Lauf:       ${runUrl}`,
      "",
      "Das bedeutet: fuer diese Nacht gibt es keinen verifizierten Stand.",
      "Der letzte gueltige Stand liegt in Google Drive unter",
      "vendora-backups/daily/ — Wiederherstellung siehe docs/backup-runbook.md.",
      "",
      "Zuerst das Log des Laufs oeffnen und die erste rote Zeile lesen; die",
      "spaeteren Fehler sind meist Folgefehler.",
    ].join("\n"),
  };
}

async function main(): Promise<void> {
  const host = required("SMTP_HOST");
  const user = required("SMTP_USER");
  const pass = required("SMTP_PASSWORD");
  const from = required("EMAIL_FROM");
  const to = required("ALERT_EMAIL_TO");
  const port = Number(process.env.SMTP_PORT ?? 465);

  const transporter = nodemailer.createTransport({
    host,
    port,
    // 465 spricht TLS ab der ersten Zeile, 587 hebt per STARTTLS ab.
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const { subject, text } = buildBody();
  const result = await transporter.sendMail({ from, replyTo: user, to, subject, text });

  // Der eigentliche Punkt: SMTP kann 250 antworten und den Empfaenger trotzdem
  // abgelehnt haben. Ungeprueft waere das ein Alarm, den niemand bekommt.
  if (!result.accepted || result.accepted.length === 0) {
    fail(
      `SMTP hat keinen Empfaenger angenommen (rejected: ${result.rejected?.join(", ") || "—"}).`
    );
  }

  info(`Alarm-Mail zugestellt an ${result.accepted.length} Empfaenger. Betreff: ${subject}`);
  if (IS_TEST) {
    info(
      "Gruen allein zaehlt nicht: bestanden ist der Test erst, wenn die Mail im " +
        "Postfach liegt. Kommt sie nicht an, sitzt das Problem in der Mailbox " +
        "(Spam, Filter), nicht in den Secrets."
    );
  }
}

if (isMain(import.meta.url)) {
  main().catch((err: unknown) => {
    fail(`Alarm-Versand fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
  });
}
