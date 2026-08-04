ALTER TABLE "orders" ADD COLUMN "paid_at" date;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text;--> statement-breakpoint
CREATE INDEX "idx_orders_user_paid_at" ON "orders" USING btree ("user_id","paid_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "chk_orders_payment_method" CHECK ("orders"."payment_method" is null or "orders"."payment_method" in ('cash', 'card', 'transfer', 'paypal', 'other'));