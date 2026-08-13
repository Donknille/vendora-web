"use client";

import { useEffect } from "react";

/**
 * Letzte Instanz: Fehler im Root-Layout selbst.
 *
 * `(app)/error.tsx` fängt alles innerhalb der Route-Gruppe, aber nicht das
 * Layout darüber — bricht das, greift keine der bestehenden Grenzen und Next.js
 * liefert seine eigene, englische Standardseite aus.
 *
 * Diese Datei ersetzt im Fehlerfall das Root-Layout vollständig. Daraus folgt
 * dreierlei, und alles davon ist Absicht und nicht Nachlässigkeit:
 *
 *  - `<html>` und `<body>` müssen hier selbst stehen.
 *  - Es gibt keine Provider, also keinen LanguageContext. Der Text ist deutsch,
 *    der Hauptsprache der Anwendung.
 *  - Die globalen Styles sind laut Next.js nicht garantiert vorhanden. Deshalb
 *    bringt die Seite ihr bisschen CSS selbst mit, statt sich auf Klassen zu
 *    verlassen, die vielleicht nie geladen werden. Die eigene CSP erlaubt
 *    `style-src 'unsafe-inline'`, ein <style>-Block ist also zulässig.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <title>Fehler — Vendora</title>
        <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0; min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
            padding: 1rem;
            font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
            background: #fafafa; color: #18181b;
          }
          .card {
            max-width: 28rem; width: 100%; text-align: center;
            background: #fff; border: 1px solid rgba(0,0,0,.12);
            border-radius: 1rem; padding: 2rem;
          }
          h1 { margin: 0 0 .5rem; font-size: 1.125rem; }
          p { margin: 0 0 1.5rem; font-size: .875rem; color: #52525b; line-height: 1.6; }
          code { font-size: .75rem; color: #a1a1aa; }
          button {
            border: 0; border-radius: .5rem; padding: .5rem 1rem;
            font: inherit; font-size: .875rem; font-weight: 500;
            background: #d4af37; color: #fff; cursor: pointer;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #09090b; color: #fafafa; }
            .card { background: #18181b; border-color: rgba(255,255,255,.1); }
            p { color: #a1a1aa; }
          }
        `}</style>

        <div className="card">
          <h1>Etwas ist schiefgelaufen</h1>
          <p>
            Die Anwendung konnte nicht geladen werden. Deine Daten sind davon nicht betroffen.
            Bitte versuche es erneut.
            {error.digest ? (
              <>
                <br />
                <code>Kennung: {error.digest}</code>
              </>
            ) : null}
          </p>
          <button type="button" onClick={() => reset()}>
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
