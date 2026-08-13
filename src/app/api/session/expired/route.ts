import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Räumt ein Session-Cookie weg, das der Server nicht mehr anerkennt, und
 * schickt danach auf die Landingpage.
 *
 * ## Warum es diesen Endpunkt gibt
 *
 * Die Weiterleitungslogik prüft an zwei Stellen Unterschiedliches:
 *
 * - `src/proxy.ts` sieht nur, **ob** ein Session-Cookie existiert. Es dort zu
 *   validieren hieße, bei jedem Seitenaufruf die Datenbank zu fragen.
 * - `src/app/(app)/layout.tsx` validiert die Sitzung dann wirklich.
 *
 * Solange beide zum selben Schluss kommen, fällt das nicht auf. Läuft eine
 * Sitzung aber serverseitig ab, während das Cookie im Browser bleibt, sagt der
 * Proxy „angemeldet" und das Layout „nicht angemeldet" — und der Aufruf von
 * `/auth/login` läuft im Kreis: Proxy schickt nach `/dashboard`, das Layout von
 * dort auf `/landing`, und weil niemand das Cookie anfasst, wiederholt sich das
 * bei jedem Versuch. Die Anmeldeseite war damit unerreichbar, ohne dass ein
 * Fehler zu sehen war.
 *
 * Der Endpunkt durchbricht das an der einzigen Stelle, die es kann: ein
 * Server-Component-Layout darf in Next.js keine Cookies setzen, ein Route
 * Handler schon.
 *
 * Er liegt bewusst **nicht** unter `/auth/*` (dorthin leitet der Proxy
 * angemeldet wirkende Aufrufe gerade weg, die Schleife wäre zurück) und nicht
 * unter `/api/auth/*` (das ist die Catch-all-Route von Better Auth).
 *
 * Ohne Sitzung aufrufbar zu sein ist hier kein Loch, sondern der Zweck: er gibt
 * nichts preis und kann nur das eigene Cookie der aufrufenden Person löschen.
 */
export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/landing", request.url));

  // Nach Namen statt nach fester Liste: Better Auth setzt je nach Konfiguration
  // `better-auth.session_token`, den Cookie-Cache `better-auth.session_data`
  // und in Produktion zusätzlich die `__Secure-`-Varianten. Eine hartkodierte
  // Liste hätte genau die Variante verfehlt, die produktiv im Einsatz ist.
  const store = await cookies();
  for (const cookie of store.getAll()) {
    if (cookie.name.includes("better-auth")) {
      // Nicht `.delete()`: das Löschen muss Pfad und Secure-Flag der gesetzten
      // Cookies treffen, sonst bleibt das Original stehen.
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: cookie.name.startsWith("__Secure-"),
      });
    }
  }

  return response;
}
