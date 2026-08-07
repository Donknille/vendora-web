# Vendora — Archiv: Security-Pentest Teil 2 + Landing Sprint 1

> **⚠ ARCHIVDOKUMENT, Stand 2026-04-19. Nicht als Anleitung befolgen.**
> Es beschreibt die **Supabase-Architektur**, die es nicht mehr gibt (Migration auf
> Neon + Better Auth im Juli 2026, PR #10). Die frühere Deployment-Checkliste in
> diesem Dokument — Supabase-RLS-SQL einspielen, `ARCJET_KEY` erstmalig setzen,
> „6 Commits ahead of origin" — ist erledigt oder gegenstandslos und wurde entfernt,
> weil sie als gültige Anweisung missverstanden wurde.
>
> **Lebender Status: [`docs/PROGRESS.md`](./PROGRESS.md).**
> Verifikationsablauf: `CLAUDE.md` → „Verifikation nach Änderungen".

---

## 1. Security-Findings aus Pentest Teil 2 (April 2026, Supabase-Ära)

Historie. Details: [docs/security-pentest-report.md](security-pentest-report.md).
Die Zählung A1–B7 stammt aus jenem Report und ist **nicht** identisch mit der
A/B/E-Nummerierung des 360-Grad-Reviews von August 2026 (v1.2.0/v1.3.0).

| # | Finding | Status damals |
|---|---------|---------------|
| A1 | Rate Limiting fail-closed | behoben (damals `middleware.ts`, heute `src/proxy.ts`) |
| A2 | updateOrder Race Condition | behoben (`storage.ts`, `db.transaction`) |
| A3 | DELETE-Endpunkte 200 statt 404 | behoben |
| A4 | Migrate DoS-Limits | behoben |
| A5 | Stripe Customer-Duplikate | behoben (idempotencyKey) |
| A6 | Auth Callback Error Swallow | behoben |
| A8 | Doku-Diskrepanz | behoben |
| B2 | RLS auf Tabellen | **gegenstandslos** — betraf Supabase/PostgREST; Neon hat keinen Anon-Key-Zugriff |

Offene Risiken von damals, soweit sie die heutige Architektur noch betreffen:

| # | Risiko | Heutiger Stand |
|---|--------|----------------|
| B1 | Trial-Abuse durch E-Mail-Aliase | weiterhin offen |
| B3 | Keine Pagination auf GET-Endpunkten | in Phase 0.5 umgesetzt |
| B4 | Webhook-Replay (keine Event-ID-Dedup) | in Phase 0.5 umgesetzt (`webhook_events`) |
| B5 | Session-Invalidierung bei Passwortänderung | war ein Supabase-Setting — für Better Auth neu zu bewerten |
| B6 | Preview-Deployments gegen Produktionsdaten | weiterhin offen |
| B7 | Admin-E-Mails in Env-Variable | weiterhin offen (bewusst, `ADMIN_EMAILS`) |

## 2. Landing Page — Sprint 1 (umgesetzt) und Roadmap

Framer Motion + react-countup, alles respektiert `prefers-reduced-motion`
(seit v1.3.0 über einen hydration-sicheren Hook).

Komponenten in `src/app/landing/_components/`: `AnimatedLogo`, `HeroHeadline`
(Wort-Carousel), `MeshGradient`, `FeatureGrid`, `PricingBox`.

**Noch offen — Sprint 2–4** (weiterhin gültige Ideenliste, keine Zusage):

- **Sprint 2 — Produkt-Erlebnis:** Mock-Dashboard-Preview mit recharts und synthetischen
  Daten; Rechnungs-Sandbox (Client-only PDF-Vorschau); optional Marktverkauf-Demo.
  Größter Hebel laut ursprünglicher Analyse: die **interaktive Rechnungs-Sandbox im Hero**.
- **Sprint 3 — Social Proof:** Testimonial-Slider, Live-User-Counter, Branchen-Switcher,
  FAQ-Accordion mit schema.org/FAQPage, Blog-Grundgerüst (ISR).
- **Sprint 4 — CMS & A/B-Testing:** Sanity oder Payload, Texte aus dem CMS,
  Edge Config für Feature-Flags, erster A/B-Test auf der Hero-Headline.
