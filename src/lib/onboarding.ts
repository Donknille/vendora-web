// Wann die Willkommens-Erklärung erscheint — als reine Funktionen, ohne DOM und
// ohne React, damit die eine Regel, um die es hier geht, im Test festgenagelt
// werden kann: sie kommt genau einmal.
//
// Zwei Ebenen halten das fest:
//  - users.onboarded_at in der Datenbank ist die Quelle der Wahrheit. Sie
//    überlebt Gerätewechsel, einen neuen Browser, geleerten Speicher und eine
//    frisch installierte PWA — genau die Fälle, an denen ein reiner
//    localStorage-Merker scheitert.
//  - localStorage ist nur die Sperre davor: sie greift sofort, noch bevor die
//    Serverantwort da ist, und auch dann, wenn gar kein Netz vorhanden ist.

/** Versioniert: ein später überarbeiteter Tour-Inhalt kann so erneut laufen. */
export const ONBOARDING_KEY = "vendora_onboarding_v1";

/**
 * Reihenfolge der Slides. Nur Kennungen — die Texte stehen in i18n (`t.help.tour`),
 * die Symbole in der Komponente. So bleibt dieses Modul frei von React und
 * Übersetzungen und damit testbar.
 */
export const TOUR_SLIDES = ["welcome", "markets", "orders", "taxes"] as const;

export type TourSlide = (typeof TOUR_SLIDES)[number];

export interface TourVisibility {
  /** localStorage-Merker dieses Geräts. */
  seenLocally: boolean;
  /** users.onboarded_at ist gesetzt; `undefined`, solange unbekannt. */
  serverOnboarded: boolean | undefined;
  /** Die Abfrage des Serverwerts läuft noch. */
  isLoading: boolean;
  /** Die Abfrage ist fehlgeschlagen (typischerweise: kein Netz). */
  isError: boolean;
}

/**
 * Die Anzeigeregel.
 *
 * Bewusst „im Zweifel nicht zeigen": solange der Serverwert unbekannt ist oder
 * die Abfrage scheitert, bleibt der Dialog weg. Einem Bestandskonto die
 * Erklärung ein zweites Mal vorzusetzen wäre der schlimmere Fehler als sie
 * einmal zu verpassen — über /hilfe ist sie ohnehin jederzeit erreichbar.
 */
export function shouldAutoStartTour({
  seenLocally,
  serverOnboarded,
  isLoading,
  isError,
}: TourVisibility): boolean {
  if (seenLocally) return false;
  if (isLoading || isError) return false;
  if (serverOnboarded === undefined) return false;
  return !serverOnboarded;
}
