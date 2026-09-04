import { describe, it, expect } from "vitest";
import { formatCurrency, formatAmountInput, parseAmount, parseAmountOrNull, formatDate } from "@/lib/formatCurrency";

// Money is integer cents throughout the app.

describe("formatCurrency", () => {
  it("formats cents German-style: grouped, comma, symbol after", () => {
    expect(formatCurrency(1250)).toBe("12,50\u00A0€");
    expect(formatCurrency(0)).toBe("0,00\u00A0€");
    expect(formatCurrency(100000)).toBe("1.000,00\u00A0€");
    expect(formatCurrency(5)).toBe("0,05\u00A0€");
    expect(formatCurrency(123456789)).toBe("1.234.567,89\u00A0€");
  });

  it("formats negative cents", () => {
    expect(formatCurrency(-550)).toBe("-5,50\u00A0€");
    expect(formatCurrency(-100000)).toBe("-1.000,00\u00A0€");
  });

  it("uses custom currency symbol", () => {
    expect(formatCurrency(1000, "$")).toBe("10,00\u00A0$");
  });
});

describe("formatAmountInput", () => {
  it("formats cents as a plain comma-decimal string", () => {
    expect(formatAmountInput(1234)).toBe("12,34");
    expect(formatAmountInput(0)).toBe("0,00");
    expect(formatAmountInput(5)).toBe("0,05");
    expect(formatAmountInput(-550)).toBe("-5,50");
  });
});

describe("parseAmount", () => {
  it("parses comma-decimal euro input into cents", () => {
    expect(parseAmount("8,50")).toBe(850);
    expect(parseAmount("12,00")).toBe(1200);
    // parseAmount handles simple comma-decimal, not thousand separators
  });

  it("parses dot-decimal input into cents", () => {
    expect(parseAmount("8.50")).toBe(850);
  });

  it("handles empty and invalid input", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
  });

  it("strips non-numeric characters", () => {
    expect(parseAmount("€12,50")).toBe(1250);
    expect(parseAmount("  8,50 €")).toBe(850);
  });

  it("rounds to whole cents", () => {
    expect(parseAmount("1,999")).toBe(200);
    expect(parseAmount("1,001")).toBe(100);
  });
});

describe("parseAmountOrNull", () => {
  it("returns null when there is no number to parse", () => {
    expect(parseAmountOrNull("")).toBeNull();
    expect(parseAmountOrNull("abc")).toBeNull();
    expect(parseAmountOrNull("€")).toBeNull();
    expect(parseAmountOrNull("-")).toBeNull();
    expect(parseAmountOrNull(",")).toBeNull();
  });

  it("returns cents for valid input", () => {
    expect(parseAmountOrNull("0")).toBe(0);
    expect(parseAmountOrNull("12,50 €")).toBe(1250);
    expect(parseAmountOrNull("1.234,56")).toBe(123456);
  });
});

describe("formatDate", () => {
  it("formats ISO date string to German locale", () => {
    const result = formatDate("2026-04-10", "de-DE");
    expect(result).toContain("10");
    expect(result).toContain("4");
    expect(result).toContain("2026");
  });

  it("formats ISO date string to English locale", () => {
    const result = formatDate("2026-04-10", "en-US");
    expect(result).toContain("10");
    expect(result).toContain("2026");
  });

  it("returns original string for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });
});
