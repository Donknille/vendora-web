ALTER TABLE "invoices" DROP CONSTRAINT "invoices_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "retention_until" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;