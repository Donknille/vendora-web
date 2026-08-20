import "server-only";
import { APP_NAME } from "@/lib/brand";
import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { backupEvents } from "./schema";
import { sendEmail } from "./email";
import { env } from "./env";

/**
 * Meldet, wenn die naechtliche Betriebssicherung ausgeblieben ist.
 *
 * Dieser Waechter haengt bewusst WEDER an GitHub NOCH an healthchecks.io. Er
 * deckt den Fall ab, den die beiden anderen Kanaele nicht sehen koennen:
 * GitHub legt `schedule`-Workflows nach 60 Tagen ohne Repo-Aktivitaet still.
 * Dann laeuft das Backup nicht mehr, es faellt aber auch nichts aus — es
 * passiert einfach nichts, und Stille ist der Zustand, den man nicht bemerkt.
 *
 * Laeuft im bestehenden Vercel-Cron (/api/cron/retention, 03:00 UTC) mit, also
 * knapp zwei Stunden nach dem geplanten Backup-Lauf. Ein eigener Cron waere
 * sauberer getrennt, wuerde aber das Hobby-Limit von zwei Cronjobs aufbrauchen.
 *
 * Der Schwellwert liegt bei 36 Stunden: ein einzelner ausgefallener Lauf darf
 * nicht sofort mailen (GitHub-Runner sind gelegentlich verspaetet), zwei
 * ausgefallene Naechte hintereinander aber sehr wohl.
 */
const MAX_AGE_HOURS = 36;
const HOUR_IN_MS = 60 * 60 * 1000;

export interface WatchdogResult {
  status: "ok" | "stale" | "never" | "not-configured";
  ageHours: number | null;
  alerted: boolean;
}

export async function checkBackupFreshness(): Promise<WatchdogResult> {
  const [latest] = await db
    .select({ occurredAt: backupEvents.occurredAt })
    .from(backupEvents)
    .where(eq(backupEvents.eventType, "backup_verified"))
    .orderBy(desc(backupEvents.occurredAt))
    .limit(1);

  const ageHours = latest
    ? (Date.now() - latest.occurredAt.getTime()) / HOUR_IN_MS
    : null;

  if (ageHours !== null && ageHours <= MAX_AGE_HOURS) {
    return { status: "ok", ageHours, alerted: false };
  }

  const status = ageHours === null ? "never" : "stale";
  const to = env.ALERT_EMAIL_TO;

  if (!to) {
    // Kein Fehler, aber sichtbar: ohne Zieladresse ist dieser Kanal stumm.
    console.error(
      "[backup-watchdog] Keine verifizierte Sicherung " +
        (ageHours === null ? "vorhanden" : `seit ${ageHours.toFixed(1)} h`) +
        " — ALERT_EMAIL_TO ist nicht gesetzt, es geht keine Mail raus."
    );
    return { status: "not-configured", ageHours, alerted: false };
  }

  const headline =
    ageHours === null
      ? "Es gibt keine einzige verifizierte Sicherung."
      : `Die letzte verifizierte Sicherung ist ${ageHours.toFixed(1)} Stunden alt.`;

  const lines = [
    "Der naechtliche Backup-Lauf ist ausgeblieben.",
    "",
    headline,
    `Erlaubt sind ${MAX_AGE_HOURS} Stunden.`,
    "",
    "Diese Meldung kommt aus der Anwendung selbst, nicht aus GitHub. Sie",
    "erscheint auch dann, wenn der Workflow gar nicht mehr startet — GitHub",
    "legt geplante Workflows nach 60 Tagen ohne Repo-Aktivitaet still.",
    "",
    "Naechster Schritt: Actions -> Backup -> Run workflow.",
    "Wiederherstellung und Protokolle: docs/backup-runbook.md",
  ];

  try {
    await sendEmail({
      to,
      subject: `${APP_NAME}: naechtliche Sicherung ausgeblieben`,
      text: lines.join("\n"),
      html: `<p>${lines.join("<br />")}</p>`,
    });
    return { status, ageHours, alerted: true };
  } catch (error) {
    console.error("[backup-watchdog] Alarm konnte nicht versendet werden:", error);
    return { status, ageHours, alerted: false };
  }
}
