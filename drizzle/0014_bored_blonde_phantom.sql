CREATE TABLE "admin_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" varchar NOT NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" varchar NOT NULL,
	"target_email" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_created_at" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_target" ON "admin_audit_log" USING btree ("target_user_id");