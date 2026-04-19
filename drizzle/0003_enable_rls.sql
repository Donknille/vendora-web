-- Enable Row Level Security on ALL tables as defense-in-depth.
-- The app uses direct Postgres via Drizzle (not PostgREST), so RLS
-- doesn't affect app queries (they run as the connection role).
-- This prevents data access via the Supabase Anon Key / PostgREST API.

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on users"
  ON users FOR ALL TO anon, authenticated USING (false);

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on orders"
  ON orders FOR ALL TO anon, authenticated USING (false);

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on order_items"
  ON order_items FOR ALL TO anon, authenticated USING (false);

-- Market Events
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on market_events"
  ON market_events FOR ALL TO anon, authenticated USING (false);

-- Market Sales
ALTER TABLE market_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on market_sales"
  ON market_sales FOR ALL TO anon, authenticated USING (false);

-- Expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on expenses"
  ON expenses FOR ALL TO anon, authenticated USING (false);

-- Company Profiles
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on company_profiles"
  ON company_profiles FOR ALL TO anon, authenticated USING (false);

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on app_settings"
  ON app_settings FOR ALL TO anon, authenticated USING (false);

-- Invoice Counters
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all PostgREST access on invoice_counters"
  ON invoice_counters FOR ALL TO anon, authenticated USING (false);
