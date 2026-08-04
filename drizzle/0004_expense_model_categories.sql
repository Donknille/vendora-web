ALTER TABLE "expenses" ALTER COLUMN "category" SET DEFAULT 'sonstiges';--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "market_id" varchar;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_market_id_market_events_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expenses_market_id" ON "expenses" USING btree ("market_id");--> statement-breakpoint
-- Map legacy free-text categories to the new EÜR enum before enforcing the check.
UPDATE "expenses" SET "category" = 'wareneinkauf_material' WHERE "category" IN ('Materials', 'Material');--> statement-breakpoint
UPDATE "expenses" SET "category" = 'software_gebuehren' WHERE "category" IN ('Subscriptions', 'Abos');--> statement-breakpoint
UPDATE "expenses" SET "category" = 'arbeitsmittel_gwg' WHERE "category" IN ('Tools', 'Werkzeug');--> statement-breakpoint
UPDATE "expenses" SET "category" = 'marketing' WHERE "category" = 'Marketing';--> statement-breakpoint
UPDATE "expenses" SET "category" = 'verpackung' WHERE "category" IN ('Packaging', 'Verpackung');--> statement-breakpoint
UPDATE "expenses" SET "category" = 'sonstiges' WHERE "category" NOT IN ('wareneinkauf_material', 'standgebuehren_raumkosten', 'fahrtkosten', 'arbeitsmittel_gwg', 'verpackung', 'marketing', 'versicherungen_beitraege', 'software_gebuehren', 'sonstiges');--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expenses_category" CHECK ("expenses"."category" in ('wareneinkauf_material', 'standgebuehren_raumkosten', 'fahrtkosten', 'arbeitsmittel_gwg', 'verpackung', 'marketing', 'versicherungen_beitraege', 'software_gebuehren', 'sonstiges'));--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expenses_source" CHECK ("expenses"."source" in ('manual', 'market_fee', 'market_travel'));