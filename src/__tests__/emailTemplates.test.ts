import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  verificationEmail,
  passwordResetEmail,
} from "@/lib/server/emailTemplates";

const URL = "https://bilanz-buddy.example/api/auth/verify-email?token=abc123&callbackURL=%2Fauth%2Fverify-email";
const BASE = "https://bilanz-buddy.example";

const templates = [
  { name: "verificationEmail", build: verificationEmail },
  { name: "passwordResetEmail", build: passwordResetEmail },
] as const;

describe("escapeHtml", () => {
  it("neutralisiert die Zeichen, mit denen man aus einem Attribut ausbricht", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    expect(escapeHtml(`" onmouseover='evil()`)).toBe("&quot; onmouseover=&#39;evil()");
  });

  it("escaped das Ampersand zuerst, sonst entstehen doppelte Entities", () => {
    // &lt; darf nicht zu &amp;lt; werden -- das ist der klassische Fehler,
    // wenn man die Reihenfolge vertauscht.
    expect(escapeHtml("a&b<c")).toBe("a&amp;b&lt;c");
  });
});

describe.each(templates)("$name", ({ build }) => {
  const mail = build({ url: URL, baseUrl: BASE });

  it("hat Betreff, HTML und Plain-Text", () => {
    expect(mail.subject).toMatch(/Bilanz-Buddy/);
    expect(mail.html.length).toBeGreaterThan(0);
    // Eine reine HTML-Mail ohne Plain-Text-Teil ist einer der staerksten
    // Spam-Marker -- der Text darf nie leer sein.
    expect(mail.text.trim().length).toBeGreaterThan(0);
  });

  it("enthält die Aktions-URL in HTML und Plain-Text", () => {
    // Im HTML steht sie escaped (& -> &amp;), im Text nackt.
    expect(mail.html).toContain(escapeHtml(URL));
    expect(mail.text).toContain(URL);
  });

  it("nennt die Gültigkeitsdauer von einer Stunde in beiden Fassungen", () => {
    expect(mail.html).toMatch(/1 Stunde/);
    expect(mail.text).toMatch(/1 Stunde/);
  });

  it("bietet den Link zusätzlich zum Button als kopierbaren Klartext an", () => {
    // Corporate-Filter zerschiessen regelmaessig Button-Links; ohne den
    // sichtbaren Fallback gaebe es dann keinen Weg mehr.
    expect(mail.html).toContain("kopiere diesen Link");
  });

  it("liefert einen MSO-Fallback für den Button", () => {
    // Outlook ignoriert border-radius und wuerde sonst einen eckigen Kasten
    // rendern statt des Marken-Buttons.
    expect(mail.html).toContain("<!--[if mso]>");
    expect(mail.html).toContain("v:roundrect");
  });

  it("verwendet die Markenfarbe statt des alten Indigo", () => {
    expect(mail.html).toContain("#D4AF37");
    expect(mail.html).not.toContain("#4f46e5");
  });

  it("escaped die URL, statt sie roh in HTML zu schreiben", () => {
    const hostile = "https://x.test/?a=1&b=2\"><script>alert(1)</script>";
    const evil = build({ url: hostile, baseUrl: BASE });
    expect(evil.html).not.toContain("<script>alert(1)</script>");
    expect(evil.html).toContain("&lt;script&gt;");
  });

  it("verweist auf Impressum und Datenschutz, wenn eine baseUrl bekannt ist", () => {
    expect(mail.html).toContain(`${BASE}/legal/impressum`);
    expect(mail.html).toContain(`${BASE}/legal/datenschutz`);
  });

  it("fällt ohne baseUrl auf die Text-Wortmarke zurück statt auf ein totes Bild", () => {
    const noBase = build({ url: URL });
    expect(noBase.html).not.toContain("<img");
    expect(noBase.html).toContain("Bilanz");
    expect(noBase.html).toContain("-Buddy");
  });

  it("setzt die Wortmarke als Text, das Zeichen nur als schmückendes Bild", () => {
    // Outlook und Gmail blockieren Remote-Bilder beim Erstkontakt. Deshalb ist
    // der Name HTML-Text und nicht Teil der Grafik -- er steht auch dann da,
    // wenn das Zeichen nicht geladen wird. Das Bild ist entsprechend
    // schmueckend und traegt einen leeren alt-Text.
    expect(mail.html).toContain(`${BASE}/apple-touch-icon.png`);
    expect(mail.html).toContain('alt=""');
    expect(mail.html).toContain("Bilanz");
    expect(mail.html).toContain("-Buddy");
    expect(mail.html).not.toContain("VENDORA");
  });
});
