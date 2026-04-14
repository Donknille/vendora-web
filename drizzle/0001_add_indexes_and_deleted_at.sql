-- Migration: Add performance indexes and deleted_at column
-- Run this in Supabase SQL Editor

-- Add deleted_at column for soft-delete support
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

-- Index on users.stripe_customer_id (used by webhook lookups)
CREATE INDEX IF NOT EXISTS "idx_users_stripe_customer_id" ON "users" ("stripe_customer_id");

-- Index on orders.user_id (every query filters by user)
CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "orders" ("user_id");

-- Index on order_items.order_id (joined on every order fetch)
CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON "order_items" ("order_id");

-- Index on market_events.user_id
CREATE INDEX IF NOT EXISTS "idx_market_events_user_id" ON "market_events" ("user_id");

-- Index on market_sales.user_id and market_sales.market_id
CREATE INDEX IF NOT EXISTS "idx_market_sales_user_id" ON "market_sales" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_market_sales_market_id" ON "market_sales" ("market_id");

-- Index on expenses.user_id
CREATE INDEX IF NOT EXISTS "idx_expenses_user_id" ON "expenses" ("user_id");
