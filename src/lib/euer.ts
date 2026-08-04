// Shared (client + server) EÜR expense categories.
// Keys are stable enum values stored in `expenses.category`; labels/mappings are
// for display and a prepared DATEV/SKR03 export (Ausbaustufe).
// Hinweis: euerLine/skr03 sind Orientierungswerte, keine Steuerberatung.

export const EUER_CATEGORIES = [
  "wareneinkauf_material",
  "standgebuehren_raumkosten",
  "fahrtkosten",
  "arbeitsmittel_gwg",
  "verpackung",
  "marketing",
  "versicherungen_beitraege",
  "software_gebuehren",
  "sonstiges",
] as const;

export type EuerCategory = (typeof EUER_CATEGORIES)[number];

export const DEFAULT_EUER_CATEGORY: EuerCategory = "sonstiges";

export interface EuerCategoryMeta {
  de: string;
  en: string;
  euerLine: string; // Anlage-EÜR-Sinnzeile (Orientierung)
  skr03: string; // provisorisches SKR03-Konto (vor Nutzung prüfen)
}

export const EUER_CATEGORY_META: Record<EuerCategory, EuerCategoryMeta> = {
  wareneinkauf_material: {
    de: "Wareneinkauf / Material",
    en: "Goods / Materials",
    euerLine: "Waren, Roh- und Hilfsstoffe",
    skr03: "3400",
  },
  standgebuehren_raumkosten: {
    de: "Standgebühren / Raumkosten",
    en: "Stall fees / Rent",
    euerLine: "Miete / Pacht (Raumkosten)",
    skr03: "4210",
  },
  fahrtkosten: {
    de: "Fahrt- / Reisekosten",
    en: "Travel costs",
    euerLine: "Reise- / Fahrtkosten",
    skr03: "4670",
  },
  arbeitsmittel_gwg: {
    de: "Arbeitsmittel / GWG",
    en: "Tools / low-value assets",
    euerLine: "GWG / Arbeitsmittel",
    skr03: "4855",
  },
  verpackung: {
    de: "Verpackung",
    en: "Packaging",
    euerLine: "Verpackungsmaterial",
    skr03: "4730",
  },
  marketing: {
    de: "Marketing / Werbung",
    en: "Marketing",
    euerLine: "Werbekosten",
    skr03: "4600",
  },
  versicherungen_beitraege: {
    de: "Versicherungen / Beiträge",
    en: "Insurance / fees",
    euerLine: "Versicherungen / Beiträge",
    skr03: "4360",
  },
  software_gebuehren: {
    de: "Software / Gebühren",
    en: "Software / fees",
    euerLine: "Sonstige betriebliche Aufwendungen",
    skr03: "4980",
  },
  sonstiges: {
    de: "Sonstiges",
    en: "Other",
    euerLine: "Sonstige betriebliche Aufwendungen",
    skr03: "4980",
  },
};

export function isEuerCategory(value: string | null | undefined): value is EuerCategory {
  return value != null && (EUER_CATEGORIES as readonly string[]).includes(value);
}

export function euerLabel(category: string | null | undefined, language: string): string {
  const key = isEuerCategory(category) ? category : DEFAULT_EUER_CATEGORY;
  const meta = EUER_CATEGORY_META[key];
  return language === "de" ? meta.de : meta.en;
}

// Legacy free-text categories (pre-Phase-1) mapped to the new enum.
const LEGACY_CATEGORY_MAP: Record<string, EuerCategory> = {
  Materials: "wareneinkauf_material",
  Material: "wareneinkauf_material",
  Shipping: "sonstiges",
  Versand: "sonstiges",
  Subscriptions: "software_gebuehren",
  Abos: "software_gebuehren",
  Tools: "arbeitsmittel_gwg",
  Werkzeug: "arbeitsmittel_gwg",
  Marketing: "marketing",
  Packaging: "verpackung",
  Verpackung: "verpackung",
  Other: "sonstiges",
};

export function mapLegacyCategory(value: string | null | undefined): EuerCategory {
  if (isEuerCategory(value)) return value;
  if (value && LEGACY_CATEGORY_MAP[value]) return LEGACY_CATEGORY_MAP[value];
  return DEFAULT_EUER_CATEGORY;
}
