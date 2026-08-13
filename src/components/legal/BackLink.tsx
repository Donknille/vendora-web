"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { iconButton } from "@/lib/styles";

/**
 * Zurück-Pfeil der Rechtsseiten.
 *
 * Vorher stand auf allen vier Seiten `<Link href="javascript:void(0)"
 * onClick={() => window.history.back()}>`. Das war an zwei Stellen falsch:
 *
 *  1. Die eigene CSP (`script-src` ohne `'unsafe-inline'`, siehe src/proxy.ts)
 *     blockiert `javascript:`-URLs. Der Klick funktionierte nur noch über den
 *     onClick-Handler, hinterließ aber bei jedem Aufruf eine CSP-Verletzung in
 *     der Konsole — also genau das Rauschen, das echte Verstöße verdeckt.
 *  2. Wer direkt hier landet — Impressum aus einer Suchmaschine, Datenschutz
 *     aus einer E-Mail —, hat keine History, in die zurückgesprungen werden
 *     könnte. Der Pfeil tat dann schlicht nichts.
 *
 * Und es ist ein `<button>`, kein `<a>`: „zurück" führt nicht zu einer
 * bestimmten Adresse, es nimmt eine zurück. Ein Anker ohne Ziel wäre für
 * Screenreader und Mittelklick eine Lüge.
 */
export function BackLink() {
  const router = useRouter();

  const goBack = () => {
    // history.length === 1 heißt: dieser Tab kennt nur diese eine Seite.
    // Dann geht es auf "/", von wo der Proxy je nach Sitzung nach /dashboard
    // oder /landing weiterleitet.
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <button type="button" onClick={goBack} aria-label="Zurück" className={iconButton}>
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
