# Security Fixes Changelog

## 2026-04-15 — Security Remediation (Teil 1 von 2)

### Phase 1 — CRITICAL

#### 1.1 Cross-Account Data Leak in React Query Cache
- **Problem:** Global query cache survived user switches; User B could see User A's data.
- **Fix:**
  - Created `AuthContext` (`lib/context/AuthContext.tsx`) providing `useCurrentUserId()`.
  - All query keys are now user-scoped: `[userId, "/api/orders"]` instead of `["/api/orders"]`.
  - Updated all hooks: `useOrders`, `useMarkets`, `useMarketSales`, `useExpenses`, `useProfile`, `useSettings`, `useSubscription`, `useCustomers`.
  - Updated `Sidebar.tsx` admin check and `dashboard/page.tsx` queries.
  - Updated `api-client.ts` default `queryFn` to find URL in multi-element keys.
  - Merged `AuthCacheGuard` from `Providers.tsx` into `AuthProvider` (single source of truth).
  - `queryClient.clear()` fires on `SIGNED_OUT` and on user switch.
- **Tests:** 3 new tests verifying user-scoped key isolation and cache clearing.

#### 1.2 Account Deletion — Complete and Irreversible
- **Problem:** Account deletion didn't delete all user data (orders, markets, etc.), only soft-deleted the user row.
- **Fix:**
  - `account/route.ts` now calls `deleteAllUserData()` inside `db.transaction()` after external API calls (Stripe, Supabase Auth).
  - `deleteAllUserData()` in `storage.ts` now accepts an optional transaction parameter.
  - Flow: Stripe customer delete → Supabase Auth delete → DB transaction (delete all data + soft-delete user).
  - `ensureUserRecord()` in `auth.ts` already blocks re-registration of deleted accounts.
  - Settings page already checks DELETE response and displays errors.
- **Tests:** 2 new tests verifying transactional deletion order and `deleteAllUserData` export.

#### 1.3 Stripe Webhook Fail-Closed
- **Status:** Already implemented.
  - `STRIPE_WEBHOOK_SECRET` missing → 500.
  - Missing `stripe-signature` header → 400.
  - Invalid signature → 400 via `constructEvent()`.
  - Body read with `request.text()`, not `request.json()`.
- **Tests:** Already existed and passing.

#### 1.4 Blocked Users Enforced Server-Side
- **Status:** Already implemented.
  - `getAuthUserId()` checks `isBlocked` and `deletedAt` in DB — returns `null` if either is set.
  - All route handlers use `getAuthUserId()`, so blocked users are rejected everywhere.
  - `requireAdmin()` delegates to `getAuthUserId()`, inheriting block check.
- **Tests:** Already existed and passing.

### Phase 2 — HIGH

#### 2.1 Backup/Restore Transactional
- **Status:** Already implemented.
  - `migrate/route.ts` wraps entire restore in `db.transaction()`.
  - Zod validation with array size limits (500 orders, 200 markets, etc.).
  - `schemaVersion: 1` in exports, validated on import.
- **Tests:** 2 new tests verifying transaction usage and round-trip schema compatibility.

#### 2.2 Stored XSS in P&L Export
- **Status:** Already implemented.
  - `dashboard/page.tsx` escapes all dynamic values with `escapeHtml()`.
  - CSP meta tag set in export HTML: `default-src 'none'; style-src 'unsafe-inline'`.
  - `profile/route.ts` validates all string fields against HTML injection via Zod + regex.
- **Tests:** Already existed and passing.

#### 2.3 Subscription Gates for Copy and Import
- **Status:** Already implemented.
  - `markets/[id]/copy/route.ts` checks `requireActiveSubscription()`.
  - `migrate/route.ts` requires `sub.status === "active"` (stricter — trial excluded).
  - Import schema has Zod array size limits for all resource types.
- **Tests:** 3 new tests verifying subscription checks and resource limits.

#### 2.4 Year Filter Operator Precedence
- **Status:** Already fixed.
  - `dashboard/page.tsx` line 88: parentheses correctly group status conditions.
  - `(status === "paid" || ... || status === "delivered") && matchesYear(...)`.
- **Tests:** Already existed and passing.

### Phase 3 — MEDIUM

#### 3.1 Database Schema Hardening
- Created `drizzle/0002_schema_hardening.sql` migration with:
  - CHECK constraints for `orders.status`, `market_events.status`, `users.subscription_status`.
  - NOT NULL enforcement on date columns.
  - Composite index `idx_orders_user_status`.
- All existing indexes verified present in schema and migration `0001`.

#### 3.2 React Performance and Lint Errors
- Fixed unused catch parameter in `theme-init.js` (`e` → `_`).
- No setState-in-useEffect issues found in any of the flagged files.
- Lint: 0 errors, 9 warnings (all pre-existing `<img>` usage).

#### 3.3 Error Handling
- `ErrorBoundary` now wrapped around children in root `layout.tsx`.
- `error.tsx` already exists at `(app)/` route group level.
- `ConfirmDialog` enhanced with:
  - Async `onConfirm` support (returns `Promise<void>`).
  - Loading state with disabled buttons during operation.
  - Error display within the dialog.
  - Close prevented during loading.

#### 3.4 CI/CD Pipeline
- **Status:** Already hardened.
  - `.github/workflows/security.yml` runs: `npm audit --audit-level=high`, `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.

#### 3.5 Security Headers
- **Status:** Already configured in `next.config.ts`:
  - `Strict-Transport-Security` with preload.
  - `X-Frame-Options: DENY`.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Content-Security-Policy` (no unsafe-inline for scripts).
  - `Permissions-Policy` (camera, microphone, geolocation denied).

#### 3.6 Rate Limiting
- Installed `@arcjet/next` for rate limiting.
- Created `lib/server/arcjet.ts` with three tiers:
  - **Auth endpoints** (login/signup): 5 req/min per IP.
  - **API writes** (POST/PUT/DELETE): 20 req/min per IP.
  - **Global**: 100 req/min per IP.
- Integrated in `middleware.ts` with Arcjet shield (SQL injection, XSS probe detection).
- Graceful degradation: rate limiting only active when `ARCJET_KEY` env var is set.

### Phase 4 — Verification

All checks pass:
- `tsc --noEmit` — clean
- `npm run lint` — 0 errors, 9 warnings (pre-existing)
- `npm test` — 50 tests, 5 files, all pass
- `npm run build` — successful
- `npm audit --audit-level=high` — no high/critical findings
