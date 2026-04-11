import { describe, it, expect } from "vitest";
import { formatCurrency, parseAmount, formatDate } from "@/lib/formatCurrency";

describe("formatCurrency", () => {
  it("formats positive amounts with euro sign and comma", () => {
    expect(formatCurrency(12.5)).toBe("€12,50");
    expect(formatCurrency(0)).toBe("€0,00");
    expect(formatCurrency(1000)).toBe("€1000,00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-5.5)).toBe("€-5,50");
  });

  it("uses custom currency symbol", () => {
    expect(formatCurrency(10, "$")).toBe("$10,00");
  });
});

describe("parseAmount", () => {
  it("parses comma-decimal input", () => {
    expect(parseAmount("8,50")).toBe(8.5);
    expect(parseAmount("12,00")).toBe(12);
    // parseAmount handles simple comma-decimal, not thousand separators
  });

  it("parses dot-decimal input", () => {
    expect(parseAmount("8.50")).toBe(8.5);
  });

  it("handles empty and invalid input", () => {
    expect(parseAmount("")).toBe(0);
    expect(parseAmount("abc")).toBe(0);
  });

  it("strips non-numeric characters", () => {
    expect(parseAmount("€12,50")).toBe(12.5);
    expect(parseAmount("  8,50 €")).toBe(8.5);
  });

  it("rounds to 2 decimal places", () => {
    expect(parseAmount("1,999")).toBe(2);
    expect(parseAmount("1,001")).toBe(1);
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
