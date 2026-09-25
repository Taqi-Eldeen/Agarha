-- Deferrable unique photo positions so a reorder can swap positions inside one transaction.
ALTER TABLE listing_photos ADD CONSTRAINT listing_photos_listing_position_key UNIQUE (listing_id, position) DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
-- Human-readable invoice numbers (AG-2026-000001).
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;--> statement-breakpoint
-- RLS for tables added after 0002.
GRANT SELECT ON car_trims TO agarha_app;--> statement-breakpoint
GRANT USAGE ON SEQUENCE invoice_number_seq TO agarha_app;--> statement-breakpoint
-- Free plan: Q1, free for dealers at launch.
INSERT INTO plans (code, name_ar, name_en, price_monthly_egp, max_live_listings, max_team_members, featured_credits_per_month, is_active, sort_order)
VALUES ('free', 'مجاني', 'Free', 0, NULL, 3, 0, true, 0)
ON CONFLICT (code) DO NOTHING;
