import { describe, it, expect } from "vitest";
import { getEffectivePlan, canCreate } from "@/lib/plan";

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

describe("canCreate", () => {
  it("only PRO may create (FREE is read-only)", () => {
    expect(canCreate("pro")).toBe(true);
    expect(canCreate("free")).toBe(false);
  });
});
