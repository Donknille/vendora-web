import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { env } from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { user, session, account, verification } from "@/lib/server/auth-schema";
import { sendEmail } from "@/lib/server/email";
import { ensureUserRecord, isEmailReserved } from "@/lib/server/provisioning";

function buttonEmail(heading: string, intro: string, url: string, cta: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
    <h2 style="margin: 0 0 12px; font-size: 20px;">${heading}</h2>
    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #444;">${intro}</p>
    <a href="${url}" style="display: inline-block; background: #4f46e5; color: #fff; text-decoration: none; font-weight: 600; padding: 12px 20px; border-radius: 8px; font-size: 15px;">${cta}</a>
    <p style="margin: 24px 0 0; font-size: 13px; color: #888;">Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br><span style="word-break: break-all; color: #4f46e5;">${url}</span></p>
    <p style="margin: 24px 0 0; font-size: 13px; color: #888;">Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
  </div>`;
}

export const auth = betterAuth({
  appName: "Vendora",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Verification stays optional so registration/login works without an email
    // provider configured. Flip to true once Resend is set up with a domain.
    requireEmailVerification: false,
    sendResetPassword: async ({ user: recipient, url }) => {
      await sendEmail({
        to: recipient.email,
        subject: "Passwort zurücksetzen – Vendora",
        html: buttonEmail(
          "Passwort zurücksetzen",
          "Klicke auf den Button, um ein neues Passwort zu wählen. Der Link ist eine Stunde gültig.",
          url,
          "Passwort zurücksetzen"
        ),
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user: recipient, url }) => {
      await sendEmail({
        to: recipient.email,
        subject: "E-Mail bestätigen – Vendora",
        html: buttonEmail(
          "E-Mail bestätigen",
          "Bestätige deine E-Mail-Adresse, um dein Vendora-Konto zu aktivieren.",
          url,
          "E-Mail bestätigen"
        ),
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          // DSGVO soft-delete guard: block re-registration of deleted accounts
          if (await isEmailReserved(userData.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Dieses Konto wurde gelöscht und kann nicht erneut registriert werden.",
            });
          }
        },
        after: async (userData) => {
          // Mirror the Better Auth user into our app `users` profile table,
          // using the same id so all domain FKs line up.
          await ensureUserRecord(userData.id, userData.email);
        },
      },
    },
  },
  // nextCookies() must be the LAST plugin — it flushes Set-Cookie in server actions.
  plugins: [nextCookies()],
});
