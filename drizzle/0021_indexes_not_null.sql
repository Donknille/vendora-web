-- Backfill vor SET NOT NULL: Bestandszeilen mit NULL wuerden die Migration sonst abbrechen.
UPDATE "market_events" SET "status" = 'open' WHERE "status" IS NULL;--> statement-breakpoint
ALTER TABLE "market_events" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_blocked" = false WHERE "is_blocked" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "is_blocked" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_customers_user_updated" ON "customers" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_expenses_user_date" ON "expenses" USING btree ("user_id","expense_date");--> statement-breakpoint
CREATE INDEX "idx_invoices_retention" ON "invoices" USING btree ("retention_until") WHERE "invoices"."archived_at" is not null;--> statement-breakpoint
CREATE INDEX "idx_market_sales_user_created" ON "market_sales" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_orders_user_created" ON "orders" USING btree ("user_id","created_at");