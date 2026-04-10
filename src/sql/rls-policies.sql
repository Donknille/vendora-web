-- ============================================================
-- Vendora: Row Level Security Policies
-- Run this in Supabase SQL Editor after creating tables
-- ============================================================

-- IMPORTANT: These policies ensure that even if someone uses
-- the Supabase JS client directly (bypassing our API), they
-- can only access their own data.

-- ── Users ──────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own record"
  ON users FOR SELECT
  USING (auth.uid()::text = id);

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  USING (auth.uid()::text = id);

-- Insert is handled by ensure-user endpoint (service role)
-- No delete policy — users cannot delete their own account via client

-- ── Orders ─────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own orders"
  ON orders FOR ALL
  USING (auth.uid()::text = user_id);

-- ── Order Items ────────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own order items"
  ON order_items FOR ALL
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = auth.uid()::text
    )
  );

-- ── Market Events ──────────────────────────────────────────
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own markets"
  ON market_events FOR ALL
  USING (auth.uid()::text = user_id);

-- ── Market Sales ───────────────────────────────────────────
ALTER TABLE market_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own market sales"
  ON market_sales FOR ALL
  USING (auth.uid()::text = user_id);

-- ── Expenses ───────────────────────────────────────────────
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own expenses"
  ON expenses FOR ALL
  USING (auth.uid()::text = user_id);

-- ── Company Profiles ───────────────────────────────────────
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own profile"
  ON company_profiles FOR ALL
  USING (auth.uid()::text = user_id);

-- ── App Settings ───────────────────────────────────────────
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own settings"
  ON app_settings FOR ALL
  USING (auth.uid()::text = user_id);

-- ── Invoice Counters ───────────────────────────────────────
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own invoice counter"
  ON invoice_counters FOR ALL
  USING (auth.uid()::text = user_id);
