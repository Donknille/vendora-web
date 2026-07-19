CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_id" varchar;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_customers_user_id" ON "customers" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Data migration: seed customer master records from existing distinct order
-- recipients, then link each order to its matching customer.
INSERT INTO "customers" ("id", "user_id", "name", "email", "street", "zip", "city", "country", "created_at", "updated_at")
SELECT gen_random_uuid(), d."user_id", d."customer_name", d."customer_email", d."customer_street", d."customer_zip", d."customer_city", d."customer_country", now(), now()
FROM (
	SELECT DISTINCT "user_id", "customer_name", "customer_email", "customer_street", "customer_zip", "customer_city", "customer_country"
	FROM "orders"
	WHERE "customer_name" <> ''
) d;--> statement-breakpoint
UPDATE "orders" o
SET "customer_id" = c."id"
FROM "customers" c
WHERE c."user_id" = o."user_id"
	AND c."name" = o."customer_name"
	AND c."email" = o."customer_email"
	AND c."street" = o."customer_street"
	AND c."zip" = o."customer_zip"
	AND c."city" = o."customer_city"
	AND c."country" = o."customer_country"
	AND o."customer_name" <> '';