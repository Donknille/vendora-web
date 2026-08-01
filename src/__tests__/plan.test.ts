import { describe, it, expect } from "vitest";
import {
  getEffectivePlan,
  limitsFor,
  monthKey,
  monthRange,
  PLAN_LIMITS,
} from "@/lib/plan";

describe("getEffectivePlan", () => {
  const now = new Date("2026-08-01T12:00:00Z");

  it("is free by default", () => {
    expect(getEffectivePlan({}, now)).toBe("free");
    expect(getEffectivePlan({ plan: "free" }, now)).toBe("free");
  });

  it("is pro only while the subscription is paid through", () => {
    expect(
      getEffectivePlan({ plan: "pro", subscriptionExpiresAt: "2026-12-31T00:00:00Z" }, now)
    ).toBe("pro");
  });

  it("auto-downgrades to free when the pro subscription has lapsed", () => {
    expect(
      getEffectivePlan({ plan: "pro", subscriptionExpiresAt: "2026-07-01T00:00:00Z" }, now)
    ).toBe("free");
  });

  it("is free if plan=pro but no expiry is set", () => {
    expect(getEffectivePlan({ plan: "pro", subscriptionExpiresAt: null }, now)).toBe("free");
  });

  it("accepts a Date expiry too", () => {
    expect(
      getEffectivePlan({ plan: "pro", subscriptionExpiresAt: new Date("2026-09-01T00:00:00Z") }, now)
    ).toBe("pro");
  });
});

describe("limitsFor", () => {
  it("free is limited, pro is unlimited", () => {
    expect(limitsFor("free")).toEqual(PLAN_LIMITS.free);
    expect(limitsFor("free").marketsPerMonth).toBe(2);
    expect(limitsFor("free").invoicesPerMonth).toBe(5);
    expect(limitsFor("free").yearExport).toBe(false);
    expect(limitsFor("pro").marketsPerMonth).toBeNull();
    expect(limitsFor("pro").invoicesPerMonth).toBeNull();
    expect(limitsFor("pro").yearExport).toBe(true);
  });
});

describe("monthKey / monthRange", () => {
  it("buckets a date into a YYYY-MM key (UTC)", () => {
    expect(monthKey("2026-08-15")).toBe("2026-08");
    expect(monthKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });

  it("produces a half-open [start, end) month range, wrapping the year", () => {
    expect(monthRange("2026-08")).toEqual({ start: "2026-08-01", end: "2026-09-01" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
});
