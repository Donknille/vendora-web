ALTER TABLE "market_sales" ADD COLUMN "client_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_market_sales_user_client" ON "market_sales" USING btree ("user_id","client_id");