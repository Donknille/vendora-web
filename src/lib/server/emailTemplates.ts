/**
 * HTML- und Plain-Text-Vorlagen fuer die transaktionalen Mails (Bestaetigung,
 * Passwort-Reset).
 *
 * Bewusst ein reines Modul ohne `server-only` und ohne env-Import: der
 * baseUrl kommt als Parameter herein, damit die Vorlagen ohne Serverkontext
 * testbar bleiben (siehe emailTemplates.test.ts).
 *
 * Warum Tabellen und Inline-Styles statt der Tailwind-Klassen der App:
 * Outlook rendert weder Flexbox noch Grid und ignoriert externe Stylesheets,
 * und Gmail entfernt <style>-Bloecke je nach Kontext. Das Layout muss also
 * ohne jedes CSS im <head> vollstaendig funktionieren -- der Dark-Mode-Block
 * dort ist Zugabe, keine Voraussetzung.
 */

import {
  APP_NAME,
  APP_NAME_HEAD,
  APP_NAME_TAIL,
  BRAND_GOLD,
  BRAND_GOLD_ON_LIGHT,
} from "@/lib/brand";

/** Markenwerte aus brand.ts, als Hex statt rgba (rgba ist in aelteren Clients unzuverlaessig). */
const BRAND = BRAND_GOLD;
const LIGHT = {
  page: "#FAFAFA",
  surface: "#FFFFFF",
  text: "#111111",
  secondary: "#666666",
  muted: "#999999",
  line: "#EAEAEA",
};
const DARK = {
  page: "#0B0F18",
  surface: "#101624",
  text: "#FFFFFF",
  secondary: "#A0A4AD",
  line: "#222A3A",
};

/** Inter ist selbst gehostet und in keinem Mail-Client verfuegbar — daher ein Stack. */
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";

const IMPRESSUM = {
  name: "Sebastian Grüber · DigitalFlowSolutions",
  street: "Falkenweg 6",
  city: "38820 Halberstadt",
};

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Escaped alles, was in den HTML-Body interpoliert wird. Die URLs kommen zwar
 * von Better Auth und nicht aus Nutzereingaben, aber ein String-Template, das
 * ungeprueft HTML zusammensetzt, ist genau das Muster, das die Security-Regeln
 * des Projekts verbieten — unabhaengig davon, wie vertrauenswuerdig die Quelle
 * heute ist.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface TemplateInput {
  preheader: string;
  heading: string;
  intro: string;
  cta: string;
  url: string;
  /** Was passiert, wenn die Mail unerwartet kam. */
  ignoreHint: string;
  baseUrl?: string;
}

const EXPIRY_HTML = "Der Link ist <strong>1 Stunde</strong> gültig.";
const EXPIRY_TEXT = "Der Link ist 1 Stunde gültig.";

function header(baseUrl: string | undefined): string {
  // Die Wortmarke ist HTML-Text, kein Bild. Outlook und Gmail blockieren
  // Remote-Bilder beim Erstkontakt standardmaessig -- als Text steht der Name
  // immer da, in beiden Faellen gleich. Manrope laesst sich in Mail-Clients
  // ohnehin nicht laden, also erbt sie die Systemschrift aus FONT.
  const wordmark = `<span class="v-heading" style="font-family:${FONT};font-size:24px;font-weight:800;letter-spacing:-0.5px;color:${LIGHT.text};vertical-align:middle;">${APP_NAME_HEAD}<span class="v-mark" style="color:${BRAND_GOLD_ON_LIGHT};">${APP_NAME_TAIL}</span></span>`;

  // Ohne baseUrl kein Remote-Bild: ein Zeichen von einer falschen Domain zeigt
  // im besten Fall nichts und im schlechtesten ein fremdes Bild.
  if (!baseUrl) {
    return wordmark;
  }

  const src = escapeHtml(`${baseUrl.replace(/\/+$/, "")}/apple-touch-icon.png`);

  return `<img src="${src}" width="36" height="36" alt=""
        style="border:0;outline:none;text-decoration:none;height:36px;width:36px;border-radius:9px;vertical-align:middle;margin-right:10px;">${wordmark}`;
}

function renderHtml({ preheader, heading, intro, cta, url, ignoreHint, baseUrl }: TemplateInput): string {
  const safeUrl = escapeHtml(url);
  const legalBase = baseUrl ? baseUrl.replace(/\/+$/, "") : "";
  const legalLinks = legalBase
    ? `<a href="${escapeHtml(`${legalBase}/legal/impressum`)}" class="v-footer-link" style="color:${LIGHT.muted};text-decoration:underline;">Impressum</a>
             &nbsp;·&nbsp;
             <a href="${escapeHtml(`${legalBase}/legal/datenschutz`)}" class="v-footer-link" style="color:${LIGHT.muted};text-decoration:underline;">Datenschutz</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(heading)}</title>
<style>
  /* Zugabe fuer Clients, die <style> ueberleben lassen. Das Basis-Design oben
     ist bereits vollstaendig inline und hell -- faellt das hier weg, sieht die
     Mail identisch aus, nur ohne Dark Mode. */
  @media (prefers-color-scheme: dark) {
    .v-body      { background-color: ${DARK.page} !important; }
    .v-card      { background-color: ${DARK.surface} !important; border-color: ${DARK.line} !important; }
    .v-heading   { color: ${DARK.text} !important; }
    .v-mark      { color: ${BRAND_GOLD} !important; }
    .v-text      { color: ${DARK.secondary} !important; }
    .v-divider   { border-color: ${DARK.line} !important; }
    .v-footer,
    .v-footer-link { color: ${DARK.secondary} !important; }
  }
  @media only screen and (max-width: 620px) {
    .v-card    { width: 100% !important; }
    .v-pad     { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body class="v-body" style="margin:0;padding:0;background-color:${LIGHT.page};">
  <div style="display:none;font-size:1px;color:${LIGHT.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="v-body" style="background-color:${LIGHT.page};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="v-card" style="width:600px;max-width:600px;background-color:${LIGHT.surface};border:1px solid ${LIGHT.line};border-radius:16px;">
          <tr>
            <td align="center" class="v-pad" style="padding:36px 40px 4px;">
              ${header(baseUrl)}
            </td>
          </tr>

          <tr>
            <td class="v-pad" style="padding:24px 40px 0;">
              <h1 class="v-heading" style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${LIGHT.text};">${escapeHtml(heading)}</h1>
              <p class="v-text" style="margin:0;font-family:${FONT};font-size:15px;line-height:1.6;color:${LIGHT.secondary};">${escapeHtml(intro)}</p>
            </td>
          </tr>

          <tr>
            <td align="center" class="v-pad" style="padding:28px 40px 0;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="25%" stroke="f" fillcolor="${BRAND}">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${escapeHtml(cta)}</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <a href="${safeUrl}" style="display:inline-block;background-color:${BRAND};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;line-height:48px;height:48px;min-width:240px;padding:0 32px;border-radius:12px;text-decoration:none;text-align:center;">${escapeHtml(cta)}</a>
              <!--<![endif]-->
            </td>
          </tr>

          <tr>
            <td align="center" class="v-pad" style="padding:16px 40px 0;">
              <p class="v-text" style="margin:0;font-family:${FONT};font-size:14px;line-height:1.5;color:${LIGHT.secondary};">${EXPIRY_HTML}</p>
            </td>
          </tr>

          <tr>
            <td class="v-pad" style="padding:28px 40px 0;">
              <p class="v-text" style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.5;color:${LIGHT.muted};">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
              </p>
              <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" style="color:${BRAND};text-decoration:underline;">${safeUrl}</a>
              </p>
            </td>
          </tr>

          <tr>
            <td class="v-pad" style="padding:28px 40px 36px;">
              <div class="v-divider" style="border-top:1px solid ${LIGHT.line};padding-top:20px;">
                <p class="v-text" style="margin:0;font-family:${FONT};font-size:13px;line-height:1.5;color:${LIGHT.muted};">${escapeHtml(ignoreHint)}</p>
              </div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="v-card" style="width:600px;max-width:600px;background-color:transparent;border:0;">
          <tr>
            <td align="center" style="padding:24px 24px 8px;">
              <p class="v-footer" style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:1.6;color:${LIGHT.muted};">
                ${escapeHtml(IMPRESSUM.name)}<br>
                ${escapeHtml(IMPRESSUM.street)} · ${escapeHtml(IMPRESSUM.city)}
              </p>
              <p class="v-footer" style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${LIGHT.muted};">
                ${legalLinks}
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText({ heading, intro, cta, url, ignoreHint }: TemplateInput): string {
  return [
    heading,
    "",
    intro,
    "",
    `${cta}:`,
    url,
    "",
    EXPIRY_TEXT,
    "",
    ignoreHint,
    "",
    "—",
    IMPRESSUM.name,
    `${IMPRESSUM.street}, ${IMPRESSUM.city}`,
  ].join("\n");
}

function render(input: TemplateInput, subject: string): EmailContent {
  return { subject, html: renderHtml(input), text: renderText(input) };
}

export function verificationEmail(opts: { url: string; baseUrl?: string }): EmailContent {
  return render(
    {
      preheader: "Noch ein Klick, dann ist dein Bilanz-Buddy-Konto aktiv.",
      heading: "Bestätige deine E-Mail-Adresse",
      intro:
        "Willkommen bei Bilanz-Buddy. Klicke auf den Button, um dein Konto zu aktivieren und mit der Einrichtung zu starten.",
      cta: "E-Mail bestätigen",
      url: opts.url,
      ignoreHint:
        "Wenn du dich nicht bei Bilanz-Buddy registriert hast, kannst du diese E-Mail ignorieren. Ohne Bestätigung wird kein Konto aktiviert.",
      baseUrl: opts.baseUrl,
    },
    `Bestätige deine E-Mail-Adresse – ${APP_NAME}`
  );
}

export function passwordResetEmail(opts: { url: string; baseUrl?: string }): EmailContent {
  return render(
    {
      preheader: "Setze dein Bilanz-Buddy-Passwort zurück.",
      heading: "Passwort zurücksetzen",
      intro:
        "Klicke auf den Button, um ein neues Passwort für dein Bilanz-Buddy-Konto zu wählen.",
      cta: "Passwort zurücksetzen",
      url: opts.url,
      ignoreHint:
        "Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt dann unverändert.",
      baseUrl: opts.baseUrl,
    },
    `Passwort zurücksetzen – ${APP_NAME}`
  );
}
