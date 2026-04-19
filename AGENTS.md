<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Vendora – Shared Agent Rules

> Diese Datei wird von Antigravity, Cursor und Claude Code gleichermaßen gelesen.
> Tool-spezifische Details: siehe CLAUDE.md

## Projekt

Vendora ist eine Multi-Tenant SaaS-Plattform für Marktplatz-Händler.
Stack: Next.js 16, Supabase Auth, Drizzle ORM, Stripe, Vercel.

## Unveränderliche Regeln

1. Jeder API-Endpunkt prüft Auth UND Ownership (user_id)
2. Kein Secret im Client-Bundle oder in NEXT_PUBLIC_* Variablen
3. Stripe-Webhooks: Signatur verifizieren oder 500 zurückgeben
4. User-Input: Zod-validiert. HTML-Output: escaped.
5. Multi-Step DB-Ops: Transaktion verwenden
6. Nach jeder Änderung: tsc, lint, test, build durchlaufen

## Struktur-Referenz

- Schema: `src/lib/schema.ts`
- Auth: `src/lib/server/auth.ts`
- DB-Queries: `src/lib/server/storage.ts`
- API: `src/app/api/`
- Docs: `docs/` (bei Bedarf lesen)
