# Security & Compliance Remediation — Changelog

**Date:** 2026-04-14
**Auditor:** Claude Opus 4.6 (Security Engineer)

---

## Phase 1 — CRITICAL (Commit: `a31324a`)

### 1.1 Cross-Account Cache Leak — FIXED
- Added `queryClient.clear()` to all logout flows (Sidebar, Settings)
- Added `AuthCacheGuard` component in Providers.tsx that listens to `onAuthStateChange`
- Cache is cleared on `SIGNED_OUT` and on user switch (`SIGNED_IN` with different userId)

### 1.2 Account Deletion — FIXED
- DELETE handler now: (1) deletes Stripe customer, (2) deletes Supabase Auth user via admin API, (3) deletes DB data
- New `src/lib/supabase/admin.ts` — Supabase admin client (requires `SUPABASE_SERVICE_ROLE_KEY` env var)
- Added `deleted_at` column to users table for soft-delete guard
- `ensureUserRecord()` rejects previously deleted accounts
- UI properly checks DELETE response and shows errors

### 1.3 Stripe Webhook Fail-Closed — FIXED
- Webhook rejects all events if `STRIPE_WEBHOOK_SECRET` is not configured (HTTP 500)
- Removed development fallback that accepted unverified events
- Fixed Stripe v22 type errors

### 1.4 Blocked Users Enforcement — FIXED
- Block check merged into `getAuthUserId()` — all endpoints now reject blocked users
- Removed redundant `getAuthUserIdStrict()`
- `requireAdmin()` inherits block check automatically
- Also checks `deleted_at` in `getAuthUserId()`

---

## Phase 2 — HIGH (Commit: `7c757fc`)

### 2.1 Transactional Backup/Restore — FIXED
- Entire restore runs in a single DB transaction (rollback on any failure)
- Original invoice numbers are preserved (no more re-generation)
- Added `schemaVersion: 1` to export format
- Aligned export/import schemas (nullable fields, all fields round-trip)

### 2.2 Stored-XSS in GuV/P&L Export — FIXED
- All dynamic values escaped with `escapeHtml()` (shared utility in `lib/escapeHtml.ts`)
- Content-Security-Policy meta tag added (no script-src)
- Removed inline `<script>` tag, print triggered via `w.onload`
- Server-side defense: profile API rejects HTML/script tags

### 2.3 Subscription Gates — FIXED
- `requireActiveSubscription()` added to market copy endpoint
- `requireActiveSubscription()` added to backup import endpoint

### 2.4 Year Filter Bug — FIXED
- Fixed operator precedence: `(paid || shipped || delivered) && matchesYear`
- Was: `paid || shipped || (delivered && matchesYear)` — paid/shipped ignored year filter

---

## Phase 3 — MEDIUM (Commit: `77a3d55`)

### 3.1 Database Schema Hardening
- Added indexes: `user_id` on orders/markets/sales/expenses, `order_id` on order_items, `market_id` on market_sales, `stripe_customer_id` on users
- SQL migration: `drizzle/0001_add_indexes_and_deleted_at.sql`

### 3.2 Lint & Performance Fixes
- Reduced lint errors from 15 to 0 (8 intentional `<img>` warnings remain)
- Fixed `setState` in `useEffect`: lazy initialization for Language/Theme/Offline contexts
- Fixed `any` types, unused imports, `<a>` replaced with `<Link>`
- Fixed AGB unescaped HTML entities

### 3.3 Error Handling
- Added `error.tsx` boundary for the `(app)` route segment

### 3.4 CI/CD Pipeline
- Added lint, test, and build steps to `.github/workflows/security.yml`
- npm audit threshold set to `high`

### 3.5 Cleanup
- Added `.npm-cache` to `.gitignore`

---

## Validation Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | Pass (0 errors) |
| `npm run lint` | 0 errors, 8 warnings (intentional `<img>`) |
| `npm test` | 41/41 tests pass |
| `npm run build` | Successful |
| `npm audit --audit-level=high` | 0 high/critical |

## New Environment Variables Required

| Variable | Purpose | Where |
|----------|---------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Account deletion (Supabase Admin API) | Vercel |
| `STRIPE_WEBHOOK_SECRET` | **Required** (no longer optional) | Vercel |

## Database Migration Required

Run `drizzle/0001_add_indexes_and_deleted_at.sql` in Supabase SQL Editor.
