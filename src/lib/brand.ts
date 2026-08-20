// Die Marke an einer Stelle. Aus Bilanz-Buddy wurde im August 2026 Bilanz-Buddy,
// und der Name steckte damals an 261 Stellen im Repo. Diese Datei ist die
// Antwort darauf: alles, was den Namen, die Domain, die Farben oder das Logo
// nennt, holt es sich hier.
//
// BEWUSST OHNE `server-only`: `emailTemplates.ts` verzichtet ebenfalls darauf,
// damit die Vorlagen testbar bleiben, und importiert von hier.

// Immer mit Bindestrich. Laut Markenbuch sind "BilanzBuddy", "Bilanz Buddy"
// und "BB" als Absender falsch — der Guard dagegen ist ein grep im Review.
export const APP_NAME = "Bilanz-Buddy";
export const APP_NAME_PRO = `${APP_NAME} Pro`;
export const APP_CLAIM = "Dein Buddy für die Zahlen.";

// Die Wortmarke wird zweifarbig gesetzt: "Bilanz" in Textfarbe, "-Buddy" in
// Gold. Getrennt, weil <Logo> beide Hälften einzeln einfärbt.
export const APP_NAME_HEAD = "Bilanz";
export const APP_NAME_TAIL = "-Buddy";

// Präfix aller Persistenz-Schlüssel (Cookies, localStorage, IndexedDB, Caches).
// Durchgängig mit Bindestrich, damit nirgends `bilanz-buddy_theme` entsteht.
export const APP_SLUG = "bilanz-buddy";

export const APP_DOMAIN = "bilanz-buddy.de";
export const APP_URL = `https://${APP_DOMAIN}`;

// Handles ohne Bindestrich — Plattformregel, der Anzeigename trägt ihn.
export const SOCIAL_HANDLE = "bilanzbuddy";

export const APP_MANIFEST_NAME = `${APP_NAME} – Marktverwaltung`;
export const APP_DESCRIPTION = "Business-Management-Tool für Kleinunternehmer";

// Gold auf dunklem Grund und in Flächen. Spiegelt `--color-brand-primary` in
// globals.css — CSS kann kein TypeScript importieren, deshalb steht der Wert
// dort ein zweites Mal, mit Verweis hierher.
export const BRAND_GOLD = "#D4AF37";
// Dasselbe Gold auf Weiß hat zu wenig Kontrast. Für Text auf hellem Grund
// nimmt das Markenbuch diesen abgedunkelten Ton.
export const BRAND_GOLD_ON_LIGHT = "#B8952F";
export const BRAND_OBSIDIAN = "#0F1522";

// Wird von scripts/generate-og-image.mjs erzeugt, nicht zur Laufzeit gerendert.
export const OG_IMAGE = "/bb-og-1200x630.png";

export const COMPANY = "DigitalFlowSolutions";
export const COMPANY_EMAIL = "info@digitalflowsolutions.de";
