ALTER TABLE "market_events" DROP CONSTRAINT "chk_market_events_status";--> statement-breakpoint
ALTER TABLE "market_events" ADD COLUMN "application_deadline" date;--> statement-breakpoint
ALTER TABLE "market_events" ADD CONSTRAINT "chk_market_events_status" CHECK ("market_events"."status" in ('open', 'applied', 'confirmed', 'completed', 'cancelled'));