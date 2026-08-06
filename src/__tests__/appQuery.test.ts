import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isReadLoading } from "@/lib/hooks/useAppQuery";

const SRC = path.resolve(__dirname, "..");

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
  const hookFiles = [
    "lib/hooks/useOrders.ts",
    "lib/hooks/useMarkets.ts",
    "lib/hooks/useExpenses.ts",
    "lib/hooks/useMarketSales.ts",
    "lib/hooks/useInvoices.ts",
    "lib/hooks/useProfile.ts",
    "lib/hooks/useSubscription.ts",
  ];

  for (const rel of hookFiles) {
    it(`${rel} does not call useQuery directly`, () => {
      const source = readFileSync(path.join(SRC, rel), "utf8");
      expect(source).not.toMatch(/\buseQuery\s*[<(]/);
      expect(source).toContain("useAppQuery");
    });
  }

  const pageFiles = [
    "app/(app)/dashboard/page.tsx",
    "app/(app)/steuer/page.tsx",
  ];

  for (const rel of pageFiles) {
    it(`${rel} does not call useQuery directly`, () => {
      const source = readFileSync(path.join(SRC, rel), "utf8");
      expect(source).not.toMatch(/\buseQuery\s*[<(]/);
    });
  }
});

describe("pages distinguish a failed read from an empty one", () => {
  const pages = [
    "app/(app)/dashboard/page.tsx",
    "app/(app)/steuer/page.tsx",
    "app/(app)/orders/page.tsx",
    "app/(app)/markets/page.tsx",
    "app/(app)/expenses/page.tsx",
    "app/(app)/orders/[id]/page.tsx",
    "app/(app)/markets/[id]/page.tsx",
  ];

  for (const rel of pages) {
    it(`${rel} renders an ErrorState`, () => {
      const source = readFileSync(path.join(SRC, rel), "utf8");
      expect(source).toContain("isError");
      expect(source).toContain("ErrorState");
    });
  }
});
