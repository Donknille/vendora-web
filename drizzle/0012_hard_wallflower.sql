ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "chk_users_plan" CHECK ("users"."plan" in ('free', 'pro'));--> statement-breakpoint
-- Data migration (Phase 4.1): existing active subscribers become PRO; everyone
-- else (trial/expired/cancelled) falls back to the FREE default. No trial lock-out.
UPDATE "users"
SET "plan" = 'pro'
WHERE "subscription_status" = 'active'
  AND "subscription_expires_at" IS NOT NULL
  AND "subscription_expires_at" > now();