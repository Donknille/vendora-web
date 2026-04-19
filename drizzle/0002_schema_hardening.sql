-- Migration: Schema hardening — additional constraints and status enforcement
-- Run this in Supabase SQL Editor AFTER verifying on staging

-- 1. Add CHECK constraints for status fields (enum-like validation at DB level)
ALTER TABLE "orders"
  ADD CONSTRAINT "chk_orders_status"
  CHECK ("status" IN ('open', 'paid', 'shipped', 'delivered', 'cancelled'));

ALTER TABLE "market_events"
  ADD CONSTRAINT "chk_market_events_status"
  CHECK ("status" IN ('open', 'completed', 'cancelled'));

ALTER TABLE "users"
  ADD CONSTRAINT "chk_users_subscription_status"
  CHECK ("subscription_status" IN ('trial', 'active', 'expired', 'cancelled'));

-- 2. Add NOT NULL constraints where semantically required
-- (orders.order_date and market_events.date should never be null)
ALTER TABLE "orders" ALTER COLUMN "order_date" SET NOT NULL;
ALTER TABLE "market_events" ALTER COLUMN "date" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "expense_date" SET NOT NULL;

-- 3. Add composite index for common dashboard query pattern (user_id + status)
CREATE INDEX IF NOT EXISTS "idx_orders_user_status" ON "orders" ("user_id", "status");

-- 4. Ensure email uniqueness is enforced (already in schema, but verify at DB level)
-- ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");
-- (already exists via schema definition)

-- NOTE: Converting text date columns (created_at, order_date, etc.) to proper
-- timestamp/date types requires application-wide changes and thorough data migration.
-- This is tracked as a future improvement but NOT safe to do in a security hotfix.
