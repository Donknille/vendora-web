-- Add client_id as nullable first so existing rows are not rejected by NOT NULL.
ALTER TABLE "market_sales" ADD COLUMN "client_id" varchar;--> statement-breakpoint
-- Backfill existing rows with a synthetic UUID before enforcing NOT NULL / the unique index.
UPDATE "market_sales" SET "client_id" = gen_random_uuid()::text WHERE "client_id" IS NULL;--> statement-breakpoint
-- Now that every row has a value, enforce NOT NULL.
ALTER TABLE "market_sales" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
-- received_at has a server-side default, so it is safe to add as NOT NULL directly.
ALTER TABLE "market_sales" ADD COLUMN "received_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
-- Unique index on (user_id, client_id) — safe now that all existing rows carry distinct UUIDs.
CREATE UNIQUE INDEX "market_sales_user_id_client_id_unique" ON "market_sales" USING btree ("user_id","client_id");
