# Vendora — Handover-Dokument

Stand: 2026-04-19
Letzte grosse Aktivitaet: Security Pentest Teil 2 + Landing Page Sprint 1

---

## 1. Deployment-Checkliste (VOR dem Push)

Reihenfolge ist wichtig, sonst laeuft Production ins 503.

### 1.1 Supabase — RLS Migration einspielen
Im Supabase Dashboard -> SQL Editor, Inhalt von
[drizzle/0003_enable_rls.sql](../drizzle/0003_enable_rls.sql) ausfuehren.
Defense-in-depth: blockt PostgREST-Zugriff ueber den Anon-Key auf alle Tabellen.
Die App (Drizzle via postgres-Role) ist **nicht** betroffen, da der Table-Owner
RLS automatisch bypassed.

### 1.2 Vercel — ARCJET_KEY setzen
Ohne diese Variable rejected die neue fail-closed Middleware jeden Request mit 503.

- Arcjet-Account anlegen: https://app.arcjet.com
- Neue Site "Vendora" erstellen
- Key kopieren (Format: `ajkey_01ABC...`)
- Vercel Dashboard -> Project -> Settings -> Environment Variables
- Name: `ARCJET_KEY`, Value: `ajkey_...`, Scope: Production + Preview + Development
- Free Tier: 5.000 Requests/Monat

### 1.3 Lokales .env.local erweitern
```
ARCJET_KEY=ajkey_...
```

### 1.4 Push nach master
```bash
git push origin master
```
Vercel deployed automatisch.

### 1.5 Smoke-Test auf Production
- Landing Page: Hero-Wort-Carousel rotiert, Features scroll-reveal, Pricing Count-Up
- Login + Dashboard laufen
- Sentry/Logs pruefen: keine 503er mehr (ARCJET_KEY aktiv)

---

## 2. Aktueller Security-Status

### 2.1 Behobene Findings (Pentest Teil 2)
Details: [docs/security-pentest-report.md](security-pentest-report.md)

| # | Finding | Status |
|---|---------|--------|
| A1 | Rate Limiting fail-closed | Behoben (middleware.ts) |
| A2 | updateOrder Race Condition | Behoben (storage.ts mit db.transaction) |
| A3 | DELETE Endpunkte 200 statt 404 | Behoben (4 Storage Functions + Routes) |
| A4 | Migrate DoS-Limits | Behoben (Orders 500->200, Items 100->50 etc.) |
| A5 | Stripe Customer-Duplikate | Behoben (idempotencyKey) |
| A6 | Auth Callback Error Swallow | Behoben (Redirect auf error page) |
| A8 | Doku-Diskrepanz | Behoben (CLAUDE.md korrigiert) |
| B2 | RLS auf Tabellen | SQL vorhanden, muss eingespielt werden (siehe 1.1) |

### 2.2 Noch offene Risiken (aus Pentest B-Sektion)

| # | Risiko | Aufwand | Prioritaet |
|---|--------|---------|------------|
| B1 | Trial-Abuse durch Gmail+Aliase | mittel | Mittel |
| B3 | Keine Pagination auf GET-Endpunkten | hoch | Mittel |
| B4 | Webhook Replay (keine Event-ID-Dedup) | niedrig | Niedrig |
| B5 | Session-Invalidierung bei PW-Aenderung | niedrig (Supabase Setting) | Mittel |
| B6 | Preview-Deployments Produktionsdaten | niedrig | Mittel |
| B7 | Admin-E-Mails in Env Var | niedrig | Niedrig |

Scorecard-Gesamt: **6.7/10** (war 6.5 vor Remediation).

---

## 3. Landing Page — Sprint 1 abgeschlossen

Framer Motion + react-countup eingebaut, alles respektiert `prefers-reduced-motion`.

### Neue Komponenten in src/app/landing/_components/
- [AnimatedLogo.tsx](../src/app/landing/_components/AnimatedLogo.tsx) — Logo-Fade-In + Scale
- [HeroHeadline.tsx](../src/app/landing/_components/HeroHeadline.tsx) — Wort-Carousel (verwaltet/abgerechnet/geplant/analysiert)
- [MeshGradient.tsx](../src/app/landing/_components/MeshGradient.tsx) — 3 floatende Blur-Blobs (CSS-only)
- [FeatureGrid.tsx](../src/app/landing/_components/FeatureGrid.tsx) — Stagger-Scroll-Reveal + Hover-Lift + Icon-Rotation
- [PricingBox.tsx](../src/app/landing/_components/PricingBox.tsx) — CountUp auf 2,99 € + Glow-Pulse

### Noch offen — Roadmap Sprint 2–4

**Sprint 2 — Produkt-Erlebnis (2 Wochen)**
- Mock-Dashboard-Preview mit recharts + synthetischen Loop-Daten
- Einfache Rechnungs-Sandbox (Client-only PDF-Vorschau)
- Optional: Markt-Schnellverkauf-Demo (Touchscreen-Widget)

**Sprint 3 — Social Proof & Personalisierung (1–2 Wochen)**
- Testimonial-Slider (3–5 Zitate, auto-rotate)
- Live-User-Counter via Server Component + unstable_cache
- Branchen-Switcher (Marktverkaeufer / Kreativer / Handwerker / Imker)
- FAQ-Accordion mit schema.org/FAQPage
- Blog-Grundgeruest (ISR)

**Sprint 4 — CMS & A/B-Testing (2 Wochen)**
- Sanity oder Payload anbinden
- Texte aus CMS, nicht hardcoded
- Vercel Edge Config fuer Feature-Flags
- Erstes A/B-Test auf Hero-Headline

Groesster Hebel laut ursprunglicher Analyse: **interaktive Rechnungs-Sandbox im Hero**.

---

## 4. Bekannte Issues (nicht security-kritisch)

- **middleware.ts -> proxy.ts**: Next.js 16 deprecated "middleware"-Convention. Migration steht aus.
- **7 Lint-Warnings**: Alle `<img>` statt `<Image>` — kosmetisch, LCP-Impact minimal.
- **Settings clientseitig in localStorage**: `app_settings`-Tabelle und `/api/settings` Route weitgehend ungenutzt (siehe CLAUDE.md Architektur-Entscheidungen).

---

## 5. Commits die noch nicht gepusht sind

Aktueller lokaler Stand: **6 Commits ahead of origin/master** (aus vorherigen Security-Phasen).
Plus die 2 neuen Commits aus dieser Session (Security Pentest Teil 2 + Landing Sprint 1).

Vor Push: siehe Deployment-Checkliste (Abschnitt 1).

---

## 6. Verifikations-Workflow

Nach jeder Aenderung:
```bash
npx tsc --noEmit    # 1. TypeScript
npm run lint        # 2. ESLint
npm test            # 3. Vitest (aktuell 50 Tests)
npm run build       # 4. Next.js Build
```

Erst wenn alle 4 gruen sind, committen.
