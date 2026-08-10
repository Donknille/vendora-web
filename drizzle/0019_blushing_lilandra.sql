CREATE TABLE "backup_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"token" text,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_backup_events_type" CHECK ("backup_events"."event_type" in ('backup_canary', 'backup_verified'))
);
--> statement-breakpoint
CREATE INDEX "idx_backup_events_type_occurred" ON "backup_events" USING btree ("event_type","occurred_at");