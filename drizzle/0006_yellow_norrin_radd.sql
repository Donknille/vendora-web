CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar,
	"invoice_number" text NOT NULL,
	"type" text DEFAULT 'invoice' NOT NULL,
	"status" text DEFAULT 'issued' NOT NULL,
	"cancels_invoice_id" varchar,
	"issue_date" date NOT NULL,
	"service_date" date,
	"seller_name" text DEFAULT '' NOT NULL,
	"seller_address" text DEFAULT '' NOT NULL,
	"seller_email" text DEFAULT '' NOT NULL,
	"seller_phone" text DEFAULT '' NOT NULL,
	"customer_name" text DEFAULT '' NOT NULL,
	"customer_email" text DEFAULT '' NOT NULL,
	"customer_street" text DEFAULT '' NOT NULL,
	"customer_zip" text DEFAULT '' NOT NULL,
	"customer_city" text DEFAULT '' NOT NULL,
	"customer_country" text DEFAULT '' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"shipping_cost" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"tax_note" text DEFAULT '' NOT NULL,
	"is_small_business" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_invoices_type" CHECK ("invoices"."type" in ('invoice', 'cancellation')),
	CONSTRAINT "chk_invoices_status" CHECK ("invoices"."status" in ('issued', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoices_user_id" ON "invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_order_id" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_invoices_user_number" ON "invoices" USING btree ("user_id","invoice_number");