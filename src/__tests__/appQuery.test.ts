import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isReadLoading } from "@/lib/hooks/useAppQuery";
import {
  collectProductSources,
  collectSourceFiles,
  readRoute,
  readSource,
  rel,
  SRC,
} from "@/test-utils/sourceScan";

const read = (abs: string) => readFileSync(abs, "utf8");

describe("isReadLoading", () => {
  it("stays loading while the session is still unknown", () => {
    // The regression this whole module exists for: React Query reports
    // isPending=true / isLoading=false for a query disabled by `enabled:
    // !!userId`, so pages rendered "no data" over real data.
    expect(
      isReadLoading({ isSessionPending: true, enabled: false, isPending: true })
    ).toBe(true);
  });

  it("stays loading while an enabled query has not resolved", () => {
    expect(
      isReadLoading({ isSessionPending: false, enabled: true, isPending: true })
    ).toBe(true);
  });

  it("is settled once an enabled query resolved", () => {
    expect(
      isReadLoading({ isSessionPending: false, enabled: false, isPending: false })
    ).toBe(false);
    expect(
      isReadLoading({ isSessionPending: false, enabled: true, isPending: false })
    ).toBe(false);
  });

  it("is settled when the query is disabled for a non-session reason", () => {
    // e.g. useMarketSales("") — no market id yet. Blocking here would hang the
    // page on a skeleton forever.
    expect(
      isReadLoading({ isSessionPending: false, enabled: false, isPending: true })
    ).toBe(false);
  });
});

describe("user-scoped reads go through useAppQuery", () => {
  // Source guard, in the style of adminDataBoundary.test.ts: a raw
  // useQuery({ enabled: !!userId }) reintroduces the phantom-empty bug,
  // because its isLoading is false while the session resolves.
  //
  // Frueher stand hier eine Liste aus sieben Hook- und zwei Seitenpfaden. Die
  // Regel gilt aber fuer den ganzen Produktcode, und was nicht in der Liste
  // stand, wurde nie geprueft — `Sidebar.tsx` ruft seit jeher direkt auf, ohne
  // dass es je aufgefallen waere. Also wird gescannt statt aufgezaehlt.
  const DIRECT_USE_QUERY = /\buseQuery\s*[<(]/;

  /**
   * Die eine begruendete Ausnahme.
   *
   * Der Bug, um den es geht, entsteht beim Lesen von `isLoading`: React Query
   * meldet fuer eine per `enabled: !!userId` abgeschaltete Abfrage
   * `isLoading === false` bei `data === undefined`, und die Seite rendert ihren
   * Leerzustand ueber echte Daten. Die Sidebar liest ausschliesslich `data`
   * (Admin-Link ja/nein) und kann den Zustand deshalb gar nicht falsch
   * darstellen — vor der Antwort gibt es den Link eben noch nicht.
   *
   * Sobald sie `isLoading` anfasst, gilt die Ausnahme nicht mehr; der Test
   * darunter faengt genau das ab.
   */
  const ALLOWED_DIRECT_CALLERS = ["src/lib/hooks/useAppQuery.ts", "src/components/Sidebar.tsx"];

  it("nobody outside the allowlist calls useQuery directly", () => {
    const offenders = collectProductSources()
      .filter((f) => DIRECT_USE_QUERY.test(read(f)))
      .map(rel)
      .filter((r) => !ALLOWED_DIRECT_CALLERS.includes(r));

    expect(
      offenders,
      `Diese Dateien rufen useQuery direkt auf und holen sich damit den ` +
        `Phantom-Leerzustand zurueck. Auf useAppQuery umstellen: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("the allowlisted files still exist (a stale entry would blind the scan)", () => {
    for (const r of ALLOWED_DIRECT_CALLERS) {
      expect(readSource(r.replace(/^src\//, "")).length).toBeGreaterThan(0);
    }
  });

  it("Sidebar keeps its exemption: it reads data, never isLoading", () => {
    const source = readSource("components/Sidebar.tsx");
    expect(
      source,
      "Die Sidebar darf useQuery nur benutzen, solange sie keinen Ladezustand " +
        "rendert. Sobald sie isLoading liest, muss sie auf useAppQuery."
    ).not.toMatch(/\bisLoading\b/);
  });

  it("every data hook goes through useAppQuery", () => {
    const hooks = collectSourceFiles(path.join(SRC, "lib", "hooks")).filter((f) =>
      /useAppQuery|useQuery/.test(read(f))
    );

    // Selbsttest: laeuft der Scan leer, ist der Guard wertlos.
    expect(hooks.length, "Keine Datenhooks gefunden — Scan laeuft ins Leere").toBeGreaterThanOrEqual(7);

    for (const file of hooks) {
      if (rel(file) === "src/lib/hooks/useAppQuery.ts") continue;
      expect(read(file), `${rel(file)} umgeht useAppQuery`).toContain("useAppQuery");
    }
  });
});

describe("pages distinguish a failed read from an empty one", () => {
  // Bewusst eine kuratierte Liste und kein Scan ueber alle Seiten: Formular-
  // und Einstellungsseiten lesen ebenfalls ueber Hooks, zeigen aber keinen
  // ErrorState. Sie hier einzusammeln wuerde die Regel ausweiten, statt sie zu
  // bewachen — das waere eine neue Anforderung, keine Absicherung.
  //
  // Gelesen wird die Route als Einheit (Seite + eigenes `_components/`), damit
  // das Zerlegen einer Seite den Guard nicht blind macht. Fehlt die Seite,
  // wirft readRoute — ein Guard ohne Ziel muss rot werden, nicht still gruen.
  const routes = [
    "app/(app)/dashboard",
    "app/(app)/steuer",
    "app/(app)/orders",
    "app/(app)/markets",
    "app/(app)/expenses",
    "app/(app)/orders/[id]",
    "app/(app)/markets/[id]",
  ];

  for (const route of routes) {
    it(`${route} renders an ErrorState`, () => {
      const source = readRoute(route);
      expect(source).toContain("isError");
      expect(source).toContain("ErrorState");
    });
  }
});
