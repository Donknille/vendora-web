import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

let _transporter: Transporter | null = null;

function isConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.EMAIL_FROM);
}

/**
 * Lazily construct the SMTP transport so importing this module never requires
 * credentials (keeps `next build` / CI green without secrets).
 *
 * Kein Connection-Pool (nodemailer-Default, `pool: true` waere die Abweichung):
 * auf Vercel lebt jede Invocation fuer sich, ein Pool haette nichts
 * wiederzuverwenden und wuerde nur offene Sockets hinterlassen.
 *
 * Die Timeouts sind der eigentliche Punkt: ohne sie haengt eine Registrierung
 * an einem stummen SMTP-Server, bis die Serverless-Funktion abgeschossen wird.
 */
function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;

  // Lokale Kopien statt env.X: nur so verengt TypeScript `string | undefined`
  // auf `string`, und nur so passt das Objekt auf die SMTP-Optionen.
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASSWORD;
  if (!host || !user || !pass || !env.EMAIL_FROM) return null;

  const port = env.SMTP_PORT ?? 465;

  _transporter = nodemailer.createTransport({
    host,
    port,
    // Port 465 spricht TLS von der ersten Zeile an; 587 startet im Klartext
    // und hebt per STARTTLS ab (nodemailer macht das selbst).
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return _transporter;
}

if (env.NODE_ENV === "production" && !isConfigured()) {
  console.error(
    "[email] SMTP is not configured — password reset and email verification will fail. " +
      "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM."
  );
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  /**
   * Pflicht, nicht optional: eine reine HTML-Mail ohne Plain-Text-Teil ist
   * einer der staerksten Spam-Marker, den es gibt.
   */
  text: string;
}

/**
 * Sends a transactional email over SMTP (Strato).
 *
 * Ohne Konfiguration:
 *  - in Development wird der Inhalt in die Konsole geschrieben, damit der
 *    Registrierungs-Flow lokal ohne Postfach durchlaeuft,
 *  - in Production wird geworfen.
 *
 * Beides wird zusaetzlich mit console.error protokolliert, weil Better Auth
 * den Fehler seinerseits verschluckt (`runInBackgroundOrAwait` awaited und
 * loggt nur ueber seinen eigenen Logger). Ohne diese Zeile scheitert der
 * Versand in Produktion voellig lautlos: die Registrierung antwortet 200, der
 * Nutzer sieht "Postfach pruefen", und niemand erfaehrt, dass nichts rausging.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    if (env.NODE_ENV === "production") {
      console.error(`[email] SMTP not configured — could not send "${subject}" to ${to}`);
      throw new Error("Email transport is not configured");
    }

    console.warn(
      `\n[email] SMTP not configured — printing instead of sending.\n` +
        `        To:      ${to}\n` +
        `        Subject: ${subject}\n` +
        `${text}\n`
    );
    return;
  }

  try {
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      // Strato verlangt, dass From dem authentifizierten Postfach entspricht.
      // Damit Antworten trotzdem irgendwo ankommen, zeigt Reply-To explizit
      // auf dasselbe Postfach -- das bleibt richtig, falls From spaeter auf
      // ein noreply@ wechselt.
      replyTo: env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, error);
    throw new Error("Failed to send email");
  }
}
