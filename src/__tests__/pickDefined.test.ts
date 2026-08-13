import { describe, it, expect } from "vitest";
import { pickDefined, emptyToNull } from "@/lib/pickDefined";

describe("pickDefined", () => {
  it("uebernimmt nur gesetzte Felder", () => {
    const result = pickDefined({ a: 1, b: undefined, c: "x" }, ["a", "b", "c"]);
    expect(result).toEqual({ a: 1, c: "x" });
  });

  it("laesst ausgelassene Schluessel weg, auch wenn sie einen Wert haben", () => {
    // Die Schluesselliste ist die Erlaubnisliste: was nicht drinsteht, kommt
    // auch dann nicht in das UPDATE, wenn es im Eingabeobjekt steht. Genau das
    // haelt einen aufgeblaehten PUT-Rumpf von den Spalten fern.
    const result = pickDefined({ a: 1, heimlich: "boese" }, ["a"]);
    expect(result).toEqual({ a: 1 });
  });

  it("unterscheidet 'nicht angefasst' von 'leeren'", () => {
    // Der Grund, warum es nicht `{ ...updates }` ist: ein durchgereichtes
    // undefined wuerde die Spalte auf NULL setzen, obwohl sie niemand
    // anfassen wollte. null dagegen ist eine Ansage und muss durch.
    const result = pickDefined({ a: undefined, b: null }, ["a", "b"]);
    expect(result).toEqual({ b: null });
    expect("a" in result).toBe(false);
  });

  it("uebernimmt falsy-Werte, die keine Auslassung sind", () => {
    // 0 und "" sind gueltige Werte — ein Versandkostenfeld auf 0,00 zu setzen
    // muss ankommen.
    const result = pickDefined({ a: 0, b: "", c: false }, ["a", "b", "c"]);
    expect(result).toEqual({ a: 0, b: "", c: false });
  });

  it("liefert ein leeres Objekt, wenn nichts gesetzt ist", () => {
    // updateMarket und updateSubscription haengen daran: bei leerem Ergebnis
    // unterbleibt das UPDATE ganz.
    expect(Object.keys(pickDefined({ a: undefined }, ["a"]))).toHaveLength(0);
  });
});

describe("emptyToNull", () => {
  it("macht aus einem leeren Formularfeld NULL", () => {
    expect(emptyToNull("")).toBeNull();
  });

  it("laesst einen echten Wert stehen", () => {
    expect(emptyToNull("2026-03-05")).toBe("2026-03-05");
  });

  it("behandelt null und undefined wie leer", () => {
    expect(emptyToNull(null)).toBeNull();
    expect(emptyToNull(undefined)).toBeNull();
  });
});
