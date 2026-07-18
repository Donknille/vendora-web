import { Resend } from "resend";

let _resend: Resend | null = null;

/**
 * Lazily construct the Resend client so importing this module never requires
 * RESEND_API_KEY (keeps `next build` / CI green without secrets).
 */
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends a transactional email via Resend.
 * If RESEND_API_KEY is not configured, this is a no-op (logs a warning) so that
 * local development without an email provider still works.
 */
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const resend = getResend();
  const from = process.env.EMAIL_FROM || "Vendora <onboarding@resend.dev>";

  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping email to ${to} (subject: "${subject}")`
    );
    return;
  }

  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    console.error("[email] Failed to send:", error);
    throw new Error("Failed to send email");
  }
}
