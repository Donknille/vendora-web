import "server-only";
import { z } from "zod";

// Central, validated access to server-side environment variables.
// Import `env` instead of reading `process.env.X!` directly so that a missing
// or malformed secret fails fast with a clear message.
const envSchema = z.object({
  // Required for the app to function at runtime.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  // Baut die Links in den Bestaetigungs- und Reset-Mails
  // (`${BETTER_AUTH_URL}/api/auth/verify-email?token=...`). Ist der Wert in
  // Produktion falsch oder fehlt er, sind alle bereits versendeten Links tot --
  // ohne dass im Log etwas auffaellt.
  BETTER_AUTH_URL: z.string().url().optional(),

  // Stripe (billing). Optional so local dev without billing still boots;
  // the routes that need them fail closed at request time.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Optional integrations — features degrade gracefully when unset.
  ARCJET_KEY: z.string().optional(),

  // E-Mail-Versand ueber das Strato-Postfach (SMTP). Alle vier Werte gehoeren
  // zusammen -- siehe superRefine unten.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // Muss bei Strato dem authentifizierten Postfach entsprechen, sonst lehnt der
  // Server mit 550 ab. Format: `Bilanz-Buddy <info@digitalflowsolutions.de>`.
  EMAIL_FROM: z.string().optional(),

  ADMIN_EMAILS: z.string().optional(),
  // Gemeinsames Geheimnis fuer den Cron-Endpunkt (Aufbewahrungsfristen).
  // Fehlt es, verweigert die Route den Dienst statt ungeschuetzt zu loeschen.
  CRON_SECRET: z.string().optional(),
  // Zieladresse fuer Betriebsalarme. Traegt den Backup-Waechter
  // (src/lib/server/backupWatchdog.ts): bleibt der naechtliche Lauf aus, ist
  // diese Mail die einzige Meldung, die weder an GitHub noch an
  // healthchecks.io haengt. Ohne den Wert loggt der Waechter nur.
  ALERT_EMAIL_TO: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
}).superRefine((value, ctx) => {
  // ACHTUNG, hier fehlt mit Absicht eine Pruefung -- und sie gehoert wieder
  // hinein, sobald die Variable gesetzt ist:
  //
  //   if (value.NODE_ENV === "production" && !value.BETTER_AUTH_URL) { ... }
  //
  // Dieser Wachposten stand am 13.08.2026 schon einmal hier und hat sofort
  // zugeschlagen: BETTER_AUTH_URL ist in Vercel Production NICHT gesetzt. Das
  // ist keine Marotte der Pruefung, sondern der eigentliche Befund. Aus dem
  // Wert werden die Links in den Bestaetigungs- und Reset-Mails gebaut; fehlt
  // er, raet Better Auth die Adresse aus den Request-Headern und trifft damit
  // die jeweilige Deployment-URL statt der oeffentlichen.
  //
  // Der Wachposten ist wieder raus, weil er die gesamte Anwendung lahmlegt
  // (fail-fast beim Modulstart, also auch Landingpage und Impressum) -- und
  // Produktion darf nicht liegen, waehrend eine Variable nachgetragen wird.
  // Reihenfolge: erst BETTER_AUTH_URL in Vercel setzen und neu deployen, dann
  // die Pruefung wieder aktivieren.

  // Halb konfiguriertes SMTP ist der Zustand, der still scheitert. Ein
  // fehlendes Passwort faellt sonst erst beim ersten echten Versand auf --
  // also mitten in einer Registrierung, deren Fehler Better Auth verschluckt
  // (runInBackgroundOrAwait loggt nur).
  //
  // Der Ausloeser sind bewusst nur die Transportwerte: ist keiner davon
  // gesetzt, gibt es schlicht kein SMTP, und ein alleinstehendes EMAIL_FROM
  // (etwa als Rest einer frueheren Konfiguration) darf den Start nicht
  // blockieren -- lokal soll die Entwicklung ohne Postfach weiterlaufen.
  //
  // SMTP_PORT fehlt hier ebenfalls: der hat mit 465 einen brauchbaren Default.
  const transport = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const;
  if (transport.every((key) => !value[key])) return;

  const required = [...transport, "EMAIL_FROM"] as const;
  const missing = required.filter((key) => !value[key]);

  if (missing.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: [missing[0]],
      message:
        `SMTP is only partially configured (missing: ${missing.join(", ")}). ` +
        `Set all of ${required.join(", ")} or none of them.`,
    });
  }
});

export type ServerEnv = z.infer<typeof envSchema>;

function loadEnv(): ServerEnv {
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) return parsed.data;

  const message =
    "Invalid server environment variables: " +
    JSON.stringify(parsed.error.flatten().fieldErrors);

  // Secrets are injected at deploy time, not during `next build` / CI, so don't
  // hard-crash the build. Everywhere else (dev server, production runtime),
  // fail fast so misconfiguration surfaces immediately.
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION
  ) {
    console.warn(`[env] ${message}`);
    return process.env as unknown as ServerEnv;
  }

  throw new Error(message);
}

export const env = loadEnv();
