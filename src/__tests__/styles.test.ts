import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as styles from "@/lib/styles";
import { collectProductSources, rel } from "@/test-utils/sourceScan";

/**
 * Wächter für Refactoring-Plan 1.3.
 *
 * 114 Stellen in 20 Dateien trugen ihre Klassenkette ausgeschrieben. Die
 * Zusammenführung nützt nur, solange die nächste Eingabemaske sie nicht wieder
 * hineinkopiert.
 */

const CHAINS = Object.entries(styles) as [string, string][];

describe("Klassenketten stehen nur in styles.ts", () => {
  it("liefert ueberhaupt Konstanten", () => {
    // Selbsttest: ohne Konstanten prueft die Schleife unten nichts.
    expect(CHAINS.length).toBeGreaterThanOrEqual(11);
    for (const [name, value] of CHAINS) {
      expect(typeof value, `${name} ist kein String`).toBe("string");
    }
  });

  it.each(CHAINS)("%s wird nirgends ausgeschrieben", (name, chain) => {
    const offenders = collectProductSources()
      .filter((f) => rel(f) !== "src/lib/styles.ts")
      .filter((f) => readFileSync(f, "utf8").includes(chain))
      .map(rel);

    expect(
      offenders,
      `${name} aus @/lib/styles importieren statt die Kette abzuschreiben: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});

describe("die Varianten sind Absicht, nicht Versehen", () => {
  /**
   * Die App hat vier Eingabefeld-Looks und zwei Label-Abstaende. Das ist der
   * Bestand; 1.3 hat ihn sichtbar gemacht, nicht angeglichen.
   *
   * Dieser Test ist kein Qualitaetsurteil, sondern eine Notiz mit Nachdruck:
   * wer die Ketten zusammenlegt, aendert das Aussehen der App und macht dabei
   * hier etwas rot. Genau dann soll jemand hinschauen und es bewusst
   * entscheiden -- statt es als Aufraeumen durchzuwinken.
   */
  it("vier Eingabefelder unterscheiden sich in Rundung, Flaeche und Polsterung", () => {
    expect(styles.inputClass).toContain("rounded-xl");
    expect(styles.inputClass).toContain("bg-input");

    expect(styles.inputSurface).toContain("rounded-lg");
    expect(styles.inputSurface).toContain("bg-surface");
    expect(styles.inputSurface).toContain("py-2.5");

    expect(styles.inputNested).toContain("bg-page");
    expect(styles.inputNested).toContain("py-2 ");

    expect(styles.inputAuth).toContain("px-4 py-3");

    expect(new Set([styles.inputClass, styles.inputSurface, styles.inputNested, styles.inputAuth]).size).toBe(4);
  });

  it("die beiden Label-Varianten unterscheiden sich nur im Abstand", () => {
    expect(styles.labelClass).toContain("mb-1.5");
    expect(styles.labelTight).toContain("mb-1");
    expect(styles.labelTight).not.toContain("mb-1.5");

    // Bis auf den Abstand identisch — genau deshalb faellt der Unterschied
    // beim Lesen nicht auf.
    const ohneAbstand = (s: string) =>
      s.split(" ").filter((c) => !c.startsWith("mb-")).sort().join(" ");
    expect(ohneAbstand(styles.labelClass)).toBe(ohneAbstand(styles.labelTight));
  });
});
