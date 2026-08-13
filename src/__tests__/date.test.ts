import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { today, isoDay, dayOf } from "@/lib/date";
import { collectProductSources, rel } from "@/test-utils/sourceScan";

afterEach(() => {
  vi.useRealTimers();
});

describe("today", () => {
  it("liefert den heutigen Tag als ISO-Datum", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));
    expect(today()).toBe("2026-03-15");
  });

  it("rechnet nach UTC, nicht nach Ortszeit", () => {
    // Festgehaltenes Bestandsverhalten, kein Wunsch: um 00:30 Berliner Zeit
    // ist es in UTC noch der Vortag, und genau den liefert today(). Das
    // betrifft das automatische Zahldatum, Belegdaten und neue Markttage.
    //
    // Wer das eines Tages korrigiert, macht diesen Test rot -- und das ist
    // richtig so: es ist eine Aenderung an Zahlen, die in die EUER laufen,
    // und keine, die nebenbei passieren darf.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-14T23:30:00.000Z")); // 00:30 MEZ am 15.
    expect(today()).toBe("2026-03-14");
  });

  it("stimmt mit dem ueberein, was die Aufrufer vorher selbst gerechnet haben", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
    // Die beiden Schreibweisen, die vorher im Umlauf waren.
    expect(today()).toBe(new Date().toISOString().slice(0, 10));
    expect(today()).toBe(new Date().toISOString().split("T")[0]);
  });
});

describe("isoDay", () => {
  it("liefert den Tag eines Date", () => {
    expect(isoDay(new Date("2026-03-15T10:00:00.000Z"))).toBe("2026-03-15");
  });

  it("rechnet ebenfalls nach UTC", () => {
    expect(isoDay(new Date("2026-03-14T23:30:00.000Z"))).toBe("2026-03-14");
  });
});

describe("dayOf", () => {
  it("beschneidet einen Zeitstempel auf den Tag", () => {
    expect(dayOf("2026-03-05T09:00:00.000Z")).toBe("2026-03-05");
  });

  it("laesst ein reines Datum unveraendert", () => {
    expect(dayOf("2026-03-05")).toBe("2026-03-05");
  });

  it("verschiebt nichts, egal welche Zeit im Stempel steht", () => {
    // Der Punkt gegenueber `new Date(s).toISOString().slice(0,10)`: hier wird
    // nur geschnitten. Ein Zeitstempel kurz vor Mitternacht bleibt auf seinem
    // Tag, statt in den naechsten zu rutschen.
    expect(dayOf("2026-03-05T23:59:59.999Z")).toBe("2026-03-05");
    expect(dayOf("2026-03-05T00:00:00.000Z")).toBe("2026-03-05");
  });

  it("stimmt mit beiden vorherigen Schreibweisen ueberein", () => {
    for (const s of ["2026-03-05T09:00:00.000Z", "2026-03-05"]) {
      expect(dayOf(s)).toBe(s.slice(0, 10));
      expect(dayOf(s)).toBe(s.split("T")[0]);
    }
  });
});

describe("Tagesdaten kommen aus einer Quelle", () => {
  // Quelltext-Guard. Die 21 handgerechneten Vorkommen sind zusammengefuehrt;
  // ohne Wachhund waere in einem halben Jahr das 22. dabei.
  const DATE_SLICING = /toISOString\(\)\s*\.?\s*(\.slice\(0,\s*10\)|\.split\("T"\)\[0\])/;

  /**
   * Zwei begruendete Ausnahmen:
   *
   * - `lib/date.ts` ist die Quelle selbst.
   * - `lib/euerReport.ts` rechnet bewusst ohne `Date()`, weil ein
   *   `new Date("2026-01-01")` je nach Zeitzone im Vorjahr landen kann. Diese
   *   Trennung sichert zusaetzlich euerSingleSource.test.ts ab.
   */
  const ERLAUBT = ["src/lib/date.ts", "src/lib/euerReport.ts"];

  it("niemand rechnet den Tag noch selbst aus", () => {
    const offenders = collectProductSources()
      .filter((f) => DATE_SLICING.test(readFileSync(f, "utf8")))
      .map(rel)
      .filter((r) => !ERLAUBT.includes(r));

    expect(
      offenders,
      `today() / isoDay() aus @/lib/date benutzen statt selbst zu schneiden: ${offenders.join(", ")}`
    ).toEqual([]);
  });

  it("die Ausnahmen existieren noch", () => {
    const vorhanden = new Set(collectProductSources().map(rel));
    for (const r of ERLAUBT) expect(vorhanden.has(r), `${r} fehlt`).toBe(true);
  });
});
