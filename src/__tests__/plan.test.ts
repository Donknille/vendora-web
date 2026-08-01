import { describe, it, expect } from "vitest";
import { getEffectivePlan, canCreate, daysLeft, TRIAL_DAYS } from "@/lib/plan";

const now = new Date("2026-08-01T12:00:00Z");
const future = "2026-12-31T00:00:00Z";
const past = "2026-07-01T00:00:00Z";

describe("getEffectivePlan", () => {
  it("is free with no plan/trial", () => {
    expect(getEffectivePlan({}, now)).toBe("free");
    expect(getEffectivePlan({ plan: "free" }, now)).toBe("free");
  });

  it("is trial while the trial is still running", () => {
    expect(getEffectivePlan({ plan: "free", trialEndsAt: future }, now)).toBe("trial");
  });

  it("is free once the trial has ended", () => {
    expect(getEffectivePlan({ plan: "free", trialEndsAt: past }, now)).toBe("free");
  });

  it("is pro while the subscription is paid through", () => {
    expect(getEffectivePlan({ plan: "pro", subscriptionExpiresAt: future }, now)).toBe("pro");
  });

  it("pro takes precedence over a still-running trial", () => {
    expect(
      getEffectivePlan({ plan: "pro", subscriptionExpiresAt: future, trialEndsAt: future }, now)
    ).toBe("pro");
  });

  it("auto-downgrades pro to trial/free when the subscription lapses", () => {
    // lapsed pro but trial still active → trial
    expect(
      getEffectivePlan({ plan: "pro", subscriptionExpiresAt: past, trialEndsAt: future }, now)
    ).toBe("trial");
    // lapsed pro and no trial → free
    expect(getEffectivePlan({ plan: "pro", subscriptionExpiresAt: past }, now)).toBe("free");
  });
});

describe("canCreate", () => {
  it("PRO and TRIAL may create; FREE is read-only", () => {
    expect(canCreate("pro")).toBe(true);
    expect(canCreate("trial")).toBe(true);
    expect(canCreate("free")).toBe(false);
  });
});

describe("daysLeft", () => {
  it("returns whole days left, null when passed/missing", () => {
    expect(daysLeft("2026-08-11T12:00:00Z", now)).toBe(10);
    expect(daysLeft(past, now)).toBeNull();
    expect(daysLeft(null, now)).toBeNull();
  });
});

describe("TRIAL_DAYS", () => {
  it("is the agreed 42-day (6-week) trial", () => {
    expect(TRIAL_DAYS).toBe(42);
  });
});
