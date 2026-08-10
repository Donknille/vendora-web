import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/**
 * Quell-Guards im Stil von marketCostGate.test.ts und appQuery.test.ts.
 *
 * src/lib/auth.ts importiert `server-only` und die DB-Verbindung, laesst sich
 * also nicht instanziieren, um die Optionen auszulesen. Geprueft wird deshalb
 * der Quelltext -- was hier steht, IST die Anforderung: ein stilles
 * Zurueckkippen auf `requireEmailVerification: false` oder auf einen
 * abweichenden Ablauf soll auffallen, bevor es deployt wird.
 */
describe("E-Mail-Bestätigung ist verpflichtend", () => {
  const auth = read("lib/auth.ts");

  it("verlangt eine bestätigte Adresse vor der ersten Session", () => {
    expect(auth).toMatch(/requireEmailVerification:\s*true/);
    expect(auth).not.toMatch(/requireEmailVerification:\s*false/);
  });

  it("definiert einen Versandweg für die Bestätigungsmail", () => {
    expect(auth).toMatch(/sendVerificationEmail:/);
  });

  it("umgeht Better Auths sendOnSignUp bewusst", () => {
    // sign-up.mjs:249 ruft `ctx.request?.clone()` beim Zusammenbauen der
    // Argumente auf, also ausserhalb von runInBackgroundOrAwait und damit
    // ausserhalb jeder Fehlerbehandlung. Ist der Body-Stream verbraucht, wirft
    // clone() `TypeError: unusable` und die Registrierung endet in einem 500 --
    // gemessen 1 von 15 Versuchen. Ein "true" hier holt den Fehler zurueck.
    expect(auth).toMatch(/sendOnSignUp:\s*false/);
  });

  it("meldet nach der Bestätigung direkt an", () => {
    expect(auth).toMatch(/autoSignInAfterVerification:\s*true/);
  });

  it("verschickt NICHT automatisch bei jedem Login-Versuch", () => {
    // sendOnSignIn wuerde aus einer bekannten Adresse ein Versandwerkzeug
    // machen: jeder Loginversuch loest eine Mail aus.
    expect(auth).not.toMatch(/sendOnSignIn:\s*true/);
  });
});

describe("Token laufen nach einer Stunde ab", () => {
  const auth = read("lib/auth.ts");

  it("definiert die Stunde als benannte Konstante", () => {
    expect(auth).toMatch(/const ONE_HOUR_IN_SECONDS = 60 \* 60;/);
  });

  it("setzt sie für Bestätigungs- und Reset-Token explizit", () => {
    // Beides ist auch der Better-Auth-Default. Explizit, damit die Anforderung
    // im Code steht und nicht an einem Default haengt, der sich in einer
    // Minor-Version aendern kann.
    expect(auth).toMatch(/expiresIn:\s*ONE_HOUR_IN_SECONDS/);
    expect(auth).toMatch(/resetPasswordTokenExpiresIn:\s*ONE_HOUR_IN_SECONDS/);
  });
});

describe("proxy lässt den Bestätigungs-Flow durch", () => {
  const proxy = read("proxy.ts");

  it("nimmt /auth/verify-email von der Weiterleitung angemeldeter Nutzer aus", () => {
    // autoSignInAfterVerification erzeugt die Session, BEVOR Better Auth auf
    // die Seite weiterleitet. Ohne die Ausnahme wirft das frische Cookie den
    // Nutzer auf /dashboard, bevor er die Erfolgsmeldung sieht.
    expect(proxy).toMatch(/pathname !== "\/auth\/verify-email"/);
  });

  it("zählt send-verification-email zu den Credential-Pfaden", () => {
    // Jeder Aufruf loest eine Mail aus; ungebremst waere das ein
    // Versandwerkzeug gegen fremde Adressen.
    const match = proxy.match(/const isCredentialPath\s*=\s*[\s\S]*?;/);
    expect(match, "isCredentialPath nicht gefunden").not.toBeNull();
    expect(match![0]).toContain("send-verification-email");
  });
});

describe("Registrierung und Login führen aus der Sackgasse heraus", () => {
  const register = read("app/auth/register/page.tsx");
  const login = read("app/auth/login/page.tsx");
  const resend = read("components/auth/ResendVerification.tsx");

  it("schickt die Registrierung auf die Bestätigungsseite zurück", () => {
    // Ohne callbackURL defaultet Better Auth auf "/".
    expect(register).toContain("callbackURL: VERIFY_CALLBACK_URL");
    expect(resend).toContain('VERIFY_CALLBACK_URL = "/auth/verify-email"');
  });

  it("löst den Versand nach der Registrierung selbst aus", () => {
    // Ersatz fuer sendOnSignUp. Faellt der Aufruf weg, registriert sich
    // jemand erfolgreich und bekommt nie eine Mail.
    expect(register).toContain("await requestVerificationEmail(email)");
    expect(resend).toContain("authClient.sendVerificationEmail");
  });

  it("bietet den Neuversand an, wo er gebraucht wird", () => {
    // Better Auth verschluckt Fehler beim Mailversand; ohne diesen Knopf gibt
    // es bei einem SMTP-Ausfall keinen Weg zurueck.
    for (const source of [register, login]) {
      expect(source).toContain("<ResendVerification");
    }
    expect(resend).toContain("sendVerificationEmail");
  });

  it("unterscheidet beim Login unbestätigt von falschem Passwort", () => {
    // Sonst liest jemand mit korrektem Passwort "Ungueltige E-Mail oder
    // Passwort" und laeuft in den Passwort-Reset, der nichts repariert.
    expect(login).toContain('authError.code === "EMAIL_NOT_VERIFIED"');
  });
});
