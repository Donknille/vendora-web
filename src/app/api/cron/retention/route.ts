import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import * as storage from "@/lib/server/storage";
import { checkBackupFreshness } from "@/lib/server/backupWatchdog";

/**
 * Löscht archivierte Rechnungen nach Ablauf der gesetzlichen Aufbewahrungsfrist.
 *
 * Die Datenschutzerklärung sagt zu, dass Belege „für die Dauer der
 * gesetzlichen Frist in entkoppelter Form aufbewahrt und anschließend gelöscht"
 * werden. Bisher wurde `retention_until` nur geschrieben und nie ausgewertet —
 * dieser Endpunkt löst die Zusage ein.
 *
 * Aufruf über Vercel Cron (siehe vercel.json). Der Schutz ist ein gemeinsames
 * Geheimnis: Vercel schickt `Authorization: Bearer $CRON_SECRET`. Ohne gesetztes
 * Secret antwortet die Route 503 statt ungeschützt zu löschen.
 */
export async function GET(request: Request) {
  try {
    const secret = env.CRON_SECRET;
    if (!secret) {
      console.error("CRON_SECRET is not configured — refusing to run retention purge");
      return NextResponse.json({ message: "Cron is not configured" }, { status: 503 });
    }

    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const deleted = await storage.purgeExpiredArchivedInvoices();

    // Der Backup-Waechter haengt hier mit drin, weil Vercel Hobby nur zwei
    // Cronjobs erlaubt. Bewusst in eigenem try/catch und NACH der Loeschung:
    // ein stummer SMTP-Server darf die Aufbewahrungsfrist nicht aushebeln.
    let backup: Awaited<ReturnType<typeof checkBackupFreshness>> | null = null;
    try {
      backup = await checkBackupFreshness();
    } catch (error) {
      console.error("GET /api/cron/retention — Backup-Waechter fehlgeschlagen:", error);
    }

    return NextResponse.json({ deleted, backup: backup?.status ?? "unknown" });
  } catch (error) {
    console.error("GET /api/cron/retention error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
