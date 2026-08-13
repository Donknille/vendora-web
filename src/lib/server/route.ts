import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getAuthUserId } from "./auth";

/**
 * Das gemeinsame Gerüst der Route Handler.
 *
 * 38-mal stand derselbe 401-Block in `src/app/api`, 37-mal derselbe
 * 500-Fang. Das war nicht nur Tipparbeit: wo ein Muster 38-mal abgeschrieben
 * wird, fällt die 39. Stelle, an der es *fehlt*, niemandem mehr auf.
 *
 * ## Was hier hineingehört und was nicht
 *
 * Hierher gehört, was für **jede** Route gleich ist: die Anmeldung prüfen, den
 * Fehler protokollieren, mit demselben Wortlaut antworten.
 *
 * Nicht hierher gehören die Zugriffsentscheidungen der einzelnen Route —
 * `requireWriteAccess`, `requireAdmin`, die Kontingentprüfungen. Die bleiben im
 * Rumpf sichtbar, weil man beim Lesen einer Route erkennen muss, wer sie
 * benutzen darf. Ein Gate, das im Wrapper verschwindet, ist ein Gate, das beim
 * nächsten Umbau übersehen wird.
 *
 * ## Warum das Label von Hand kommt
 *
 * Die Protokollzeile lautet heute `"PUT /api/markets/[id] error:"` — sie nennt
 * das Routen*muster*, nicht die aufgerufene URL. Aus dem `Request` lässt sich
 * das nicht zurückgewinnen (dort steht `/api/markets/abc123`), und der Handler
 * kennt seinen eigenen Dateipfad nicht. Also wird es übergeben. Ein Guard
 * prüft, dass das Label zur Datei passt.
 */

/** 401 mit dem Wortlaut, den `apiError.ts` im Client erwartet. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

/** Fehlerantwort mit eigenem Wortlaut, optional mit Code für den Client. */
export function fail(
  status: number,
  message: string,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({ message, ...extra }, { status });
}

/** 400 samt Feldfehlern — dieselbe Form, die die Formulare schon auswerten. */
export function validationError(error: ZodError): NextResponse {
  return NextResponse.json(
    { message: "Validation error", errors: error.flatten().fieldErrors },
    { status: 400 }
  );
}

type RouteContext<P> = { params: Promise<P> };

type RouteHandler<P> = (
  request: Request,
  context?: RouteContext<P>
) => Promise<Response>;

/**
 * Try/catch-Rahmen ohne Anmeldeprüfung.
 *
 * Für die Routen, die ihren Zugang anders regeln: Admin-Endpunkte prüfen über
 * `requireAdmin()` (das den 403-Fall kennt), der Cron-Endpunkt über ein
 * gemeinsames Geheimnis. Sie bekommen denselben Fehlerfang, aber nicht das
 * Sitzungs-Gate — sonst liefe `getAuthUserId()` zweimal.
 */
export interface RouteOptions {
  /**
   * Wortlaut der 500-Antwort. Voreinstellung ist `"Internal server error"` —
   * `/api/account` antwortet abweichend `"Failed to delete account"`, und
   * dieser Unterschied ist Teil des Vertrags, nicht Zufall: eine gescheiterte
   * Kontolöschung ist für die Nutzerin etwas anderes als ein allgemeiner
   * Serverfehler.
   */
  errorMessage?: string;
}

export function withRoute<P = Record<string, string>>(
  label: string,
  handler: (args: { request: Request; params: P }) => Promise<Response>,
  opts: RouteOptions = {}
): RouteHandler<P> {
  return async (request, context) => {
    try {
      const params = ((await context?.params) ?? {}) as P;
      return await handler({ request, params });
    } catch (error) {
      console.error(`${label} error:`, error);
      return fail(500, opts.errorMessage ?? "Internal server error");
    }
  };
}

/**
 * Der Regelfall: angemeldet sein oder 401.
 *
 * `label` ist `"<METHODE> <Routenmuster>"`, exakt wie bisher in der
 * Protokollzeile.
 */
export function withAuth<P = Record<string, string>>(
  label: string,
  handler: (args: { userId: string; request: Request; params: P }) => Promise<Response>,
  opts: RouteOptions = {}
): RouteHandler<P> {
  return withRoute<P>(
    label,
    async ({ request, params }) => {
      const userId = await getAuthUserId();
      if (!userId) return unauthorized();
      return handler({ userId, request, params });
    },
    opts
  );
}
