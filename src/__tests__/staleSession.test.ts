import { describe, it, expect, vi } from "vitest";
import { readSource } from "@/test-utils/sourceScan";

/**
 * Regression: die Anmeldeseite war unerreichbar, sobald ein Session-Cookie im
 * Browser lag, das der Server nicht mehr anerkennt.
 *
 * Die Schleife: `src/proxy.ts` prüft nur die Anwesenheit des Cookies und
 * schickt von `/auth/login` nach `/dashboard`; `(app)/layout.tsx` validiert
 * dort wirklich, findet nichts und schickt zurück. Weil niemand das Cookie
 * anfasste, wiederholte sich das bei jedem Versuch — ohne Fehlermeldung.
 */

const cookieStore = {
  entries: [] as { name: string; value: string }[],
};

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => cookieStore.entries }),
}));

describe("/api/session/expired", () => {
  it("loescht die Better-Auth-Cookies und leitet auf die Landingpage", async () => {
    cookieStore.entries = [
      { name: "better-auth.session_token", value: "abgelaufen" },
      { name: "better-auth.session_data", value: "zwischengespeichert" },
      { name: "bilanz-buddy-language", value: "de" },
    ];

    const { GET } = await import("@/app/api/session/expired/route");
    const res = await GET(new Request("http://localhost/api/session/expired"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/landing");

    const gesetzt = res.headers.getSetCookie();
    // Beide Better-Auth-Cookies werden geleert ...
    expect(gesetzt.some((c) => c.startsWith("better-auth.session_token="))).toBe(true);
    expect(gesetzt.some((c) => c.startsWith("better-auth.session_data="))).toBe(true);
    // ... und alle mit sofortigem Ablauf.
    for (const c of gesetzt) expect(c).toMatch(/Max-Age=0/i);
    // Fremde Cookies bleiben unangetastet: Sprache und Thema haben mit der
    // Anmeldung nichts zu tun.
    expect(gesetzt.some((c) => c.startsWith("bilanz-buddy-language="))).toBe(false);
  });

  it("trifft auch die __Secure-Variante aus der Produktion", async () => {
    // Produktiv setzt Better Auth `__Secure-better-auth.session_token`. Eine
    // hartkodierte Namensliste haette genau die verfehlt.
    cookieStore.entries = [
      { name: "__Secure-better-auth.session_token", value: "abgelaufen" },
    ];

    const { GET } = await import("@/app/api/session/expired/route");
    const res = await GET(new Request("https://example.org/api/session/expired"));

    const gesetzt = res.headers.getSetCookie();
    expect(gesetzt.some((c) => c.startsWith("__Secure-better-auth.session_token="))).toBe(true);
    // Ein `__Secure-`-Cookie laesst sich nur mit gesetztem Secure-Flag loeschen.
    expect(gesetzt.some((c) => /Secure/i.test(c))).toBe(true);
  });
});

describe("die Schleife ist an der Wurzel geschlossen", () => {
  it("das (app)-Layout leitet Ungueltiges ueber den Aufraeum-Endpunkt", () => {
    // Ein direktes redirect("/landing") liesse das Cookie stehen -- und damit
    // die Schleife.
    const layout = readSource("app/(app)/layout.tsx");
    expect(layout).toContain("/api/session/expired");
    expect(layout).not.toMatch(/redirect\("\/landing"\)/);
  });

  it("der Aufraeum-Endpunkt liegt ausserhalb der Pfade, die der Proxy umleitet", () => {
    // Unter /auth/* wuerde der Proxy ihn selbst wegleiten (Cookie ist ja noch
    // da), unter /api/auth/* kollidierte er mit Better Auths Catch-all.
    const proxy = readSource("proxy.ts");
    expect(proxy).toContain('pathname.startsWith("/api")');

    // /api/... verlaesst den Proxy vor jeder Auth-Weiterleitung.
    const apiKurzschluss = proxy.indexOf('pathname.startsWith("/api")');
    const authWeiterleitung = proxy.indexOf('pathname.startsWith("/auth")');
    expect(apiKurzschluss).toBeGreaterThan(-1);
    expect(apiKurzschluss).toBeLessThan(authWeiterleitung);
  });
});
