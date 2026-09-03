import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Quelltext-Wächter für den Stripe-Webhook. Beide Regeln sind reine
 * Reihenfolge-Fragen, die kein Typ und kein Unit-Test mit Mocks bemerkt:
 *
 *  1. Der Webhook darf NICHT durch das Arcjet-Rate-Limit laufen. Er kommt
 *     immer von denselben wenigen Stripe-IPs; ein Zustell-Burst lief in das
 *     20/min-Schreibbudget, bekam 429, und der Abo-Status blieb still falsch.
 *  2. Die Idempotenz-Reservierung muss VOR der Verarbeitung und atomar sein
 *     (Insert mit Konflikt-Ignorieren), nicht Select-dann-Insert danach.
 *
 * Mutation zum Rotfahren: die frühe Rückgabe für STRIPE_WEBHOOK_PATH in
 * proxy.ts hinter `protect(` verschieben bzw. die Reservierung im Webhook
 * wieder hinter `handleEvent(` setzen.
 */

const proxy = readFileSync("src/proxy.ts", "utf8");
const webhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");

describe("Stripe-Webhook", () => {
  it("wird im Proxy vor dem Rate-Limiter durchgelassen", () => {
    const guard = proxy.indexOf("pathname === STRIPE_WEBHOOK_PATH");
    const protect = proxy.indexOf(".protect(request)");
    expect(guard).toBeGreaterThan(-1);
    expect(protect).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(protect);
    expect(proxy).toContain('STRIPE_WEBHOOK_PATH = "/api/stripe/webhook"');
  });

  it("reserviert die Event-ID atomar, bevor es verarbeitet", () => {
    const claim = webhook.indexOf(".onConflictDoNothing()");
    const handle = webhook.indexOf("await handleEvent(event)");
    expect(claim).toBeGreaterThan(-1);
    expect(handle).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(handle);
    // Kein Select-dann-Insert mehr.
    expect(webhook).not.toMatch(/select\(\{ eventId: webhookEvents\.eventId \}\)/);
  });

  it("gibt die Reservierung bei einem Verarbeitungsfehler wieder frei", () => {
    expect(webhook).toMatch(/catch \(error\) \{\s*await db\s*\.delete\(webhookEvents\)/);
  });

  it("protokolliert, wenn ein Event keinem Konto zugeordnet werden kann", () => {
    // Jeder Zweig, der still nichts tat, muss jetzt eine Spur hinterlassen.
    expect(webhook).toContain("checkout.session.completed ohne User-ID");
    expect(webhook).toContain("invoice.payment_succeeded für unbekannten Customer");
    expect(webhook).toContain("customer.subscription.deleted für unbekannten Customer");
  });
});
