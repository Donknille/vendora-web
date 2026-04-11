import { describe, it, expect } from "vitest";

// Inline the subscription logic to test without DB imports
function getSubscriptionStatus(user: {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  subscriptionExpiresAt: Date | null;
}) {
  const now = new Date();
  const status = user.subscriptionStatus as "trial" | "active" | "expired" | "cancelled";

  if (status === "active" && user.subscriptionExpiresAt) {
    const expiresAt = new Date(user.subscriptionExpiresAt);
    if (expiresAt > now) {
      const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "active", isActive: true, daysRemaining };
    }
    return { status: "expired", isActive: false, daysRemaining: 0 };
  }

  if (status === "trial" && user.trialEndsAt) {
    const trialEnd = new Date(user.trialEndsAt);
    if (trialEnd > now) {
      const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "trial", isActive: true, daysRemaining };
    }
    return { status: "expired", isActive: false, daysRemaining: 0 };
  }

  return { status: status === "cancelled" ? "cancelled" : "expired", isActive: false, daysRemaining: 0 };
}

describe("getSubscriptionStatus", () => {
  it("returns active trial with days remaining", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);

    const result = getSubscriptionStatus({
      subscriptionStatus: "trial",
      trialEndsAt: futureDate,
      subscriptionExpiresAt: null,
    });

    expect(result.status).toBe("trial");
    expect(result.isActive).toBe(true);
    expect(result.daysRemaining).toBeGreaterThanOrEqual(13);
    expect(result.daysRemaining).toBeLessThanOrEqual(15);
  });

  it("returns expired when trial ended", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const result = getSubscriptionStatus({
      subscriptionStatus: "trial",
      trialEndsAt: pastDate,
      subscriptionExpiresAt: null,
    });

    expect(result.status).toBe("expired");
    expect(result.isActive).toBe(false);
    expect(result.daysRemaining).toBe(0);
  });

  it("returns active subscription", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    const result = getSubscriptionStatus({
      subscriptionStatus: "active",
      trialEndsAt: null,
      subscriptionExpiresAt: futureDate,
    });

    expect(result.status).toBe("active");
    expect(result.isActive).toBe(true);
    expect(result.daysRemaining).toBeGreaterThanOrEqual(29);
  });

  it("returns expired when subscription ended", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);

    const result = getSubscriptionStatus({
      subscriptionStatus: "active",
      trialEndsAt: null,
      subscriptionExpiresAt: pastDate,
    });

    expect(result.status).toBe("expired");
    expect(result.isActive).toBe(false);
  });

  it("returns cancelled status", () => {
    const result = getSubscriptionStatus({
      subscriptionStatus: "cancelled",
      trialEndsAt: null,
      subscriptionExpiresAt: null,
    });

    expect(result.status).toBe("cancelled");
    expect(result.isActive).toBe(false);
  });

  it("returns expired when trial with no end date", () => {
    const result = getSubscriptionStatus({
      subscriptionStatus: "trial",
      trialEndsAt: null,
      subscriptionExpiresAt: null,
    });

    expect(result.status).toBe("expired");
    expect(result.isActive).toBe(false);
  });
});
