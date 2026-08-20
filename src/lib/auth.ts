import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { APP_NAME } from "@/lib/brand";
import { user, session, account, verification } from "@/lib/server/auth-schema";
import { sendEmail } from "@/lib/server/email";
import { verificationEmail, passwordResetEmail } from "@/lib/server/emailTemplates";
import { ensureUserRecord, ensureUserRecordById } from "@/lib/server/provisioning";

/** Eine Stunde. Steht hier explizit, damit die Anforderung im Code sichtbar
 *  ist und nicht an einem Library-Default haengt, der sich in einer Minor
 *  aendern kann. */
const ONE_HOUR_IN_SECONDS = 60 * 60;

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Ohne bestaetigte Adresse gibt es keine Session. Die Registrierung
    // antwortet dann mit { token: null } und der Login mit 403
    // EMAIL_NOT_VERIFIED -- beides wird in der UI gesondert behandelt.
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: ONE_HOUR_IN_SECONDS,
    // Eine gestohlene Session soll den Passwortwechsel nicht ueberleben --
    // sonst ist der Reset gegen genau den Fall wirkungslos, fuer den man ihn
    // benutzt.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user: recipient, url }) => {
      const mail = passwordResetEmail({ url, baseUrl: env.BETTER_AUTH_URL });
      await sendEmail({ to: recipient.email, ...mail });
    },
  },
  emailVerification: {
    // ACHTUNG, nicht auf true "korrigieren". Better Auth 1.6.23 baut den
    // Aufruf in sign-up.mjs:241-249 so:
    //
    //   await ctx.context.runInBackgroundOrAwait(
    //     sendVerificationEmail({ user, url, token }, ctx.request?.clone())
    //   );
    //
    // `ctx.request?.clone()` wird beim Zusammenbauen der Argumente
    // ausgewertet -- also BEVOR runInBackgroundOrAwait ueberhaupt laeuft und
    // damit ausserhalb dessen try/catch. Ist der Body-Stream zu dem Zeitpunkt
    // schon verbraucht, wirft clone() `TypeError: unusable`, und die ganze
    // Registrierung endet in einem 500. Gemessen: 1 von 15 Versuchen.
    //
    // Deshalb loest die Registrierungsseite die Mail selbst ueber
    // POST /send-verification-email aus (requestVerificationEmail in
    // components/auth/ResendVerification.tsx). Dieser Pfad reicht `ctx.request`
    // unveraendert weiter, ohne clone(), und ist derselbe, den der
    // "Erneut senden"-Knopf benutzt.
    //
    // Nebeneffekt, der uns entgegenkommt: bei einer zweiten Registrierung mit
    // derselben Adresse antwortet Better Auth aus Enumerations-Schutz mit einem
    // synthetischen Erfolg und verschickt NICHTS. Der explizite Aufruf schickt
    // dem bereits angelegten, unbestaetigten Konto trotzdem seinen Link.
    sendOnSignUp: false,
    // Ein Klick genuegt: der Nutzer landet direkt angemeldet auf
    // /auth/verify-email und muss sich nicht erneut einloggen.
    autoSignInAfterVerification: true,
    expiresIn: ONE_HOUR_IN_SECONDS,
    // Bewusst KEIN sendOnSignIn: das verschickt bei jedem Login-Versuch mit
    // unbestaetigter Adresse automatisch eine Mail und macht aus einer
    // bekannten Adresse eine Mail-Bombe, die nur Rate-Limits bremsen. Der
    // Neuversand ist stattdessen ein Button, den die Nutzerin selbst drueckt.
    //
    // Wichtig: Better Auth kapselt diesen Aufruf in runInBackgroundOrAwait und
    // VERSCHLUCKT geworfene Fehler (siehe sign-up.mjs / create-context.mjs).
    // Ein SMTP-Ausfall laesst die Registrierung erfolgreich aussehen, waehrend
    // nie eine Mail rausgeht -- deshalb protokolliert sendEmail selbst, und
    // deshalb ist der "Erneut senden"-Button die eigentliche Rettungsleine.
    sendVerificationEmail: async ({ user: recipient, url }) => {
      const mail = verificationEmail({ url, baseUrl: env.BETTER_AUTH_URL });
      await sendEmail({ to: recipient.email, ...mail });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (userData) => {
          // Mirror the Better Auth user into our app `users` profile table,
          // using the same id so all domain FKs line up.
          await ensureUserRecord(userData.id, userData.email);
        },
      },
    },
    session: {
      create: {
        // Bewusst "after": Better Auth fuehrt die Registrierung in einer
        // Transaktion aus, und die Session wird noch INNERHALB dieser
        // Transaktion angelegt. Ein before-Hook liest ueber den App-Pool, also
        // eine andere Verbindung, und saehe die noch nicht committete
        // Auth-Zeile gar nicht -- er waere bei der Registrierung wirkungslos.
        after: async (sessionData) => {
          // Zweiter Anlauf fuer das Profil. Scheitert der
          // user.create.after-Hook (Verbindungsabbruch im falschen Moment),
          // existiert die Auth-Identitaet ohne Profilzeile: der Login gelingt,
          // aber jeder API-Aufruf endet in 401 -- auch Datenexport und
          // Kontoloeschung, ohne Weg zurueck. Spaetestens beim naechsten Login
          // ist der Zustand hier repariert.
          //
          // Am Session-Hook statt in getAuthUserId, weil ein geloeschtes Konto
          // keine neue Session mehr bekommt (die Better-Auth-Zeile ist weg):
          // ein Nachlegen beim Session-Check haette geloeschte Konten ueber ein
          // altes Cookie wiederbelebt.
          if (sessionData.userId) {
            try {
              await ensureUserRecordById(sessionData.userId);
            } catch (error) {
              console.error("ensureUserRecordById on session create failed:", error);
            }
          }
        },
      },
    },
  },
  // nextCookies() must be the LAST plugin — it flushes Set-Cookie in server actions.
  plugins: [nextCookies()],
});
