-- 1. SRID on geometry columns (drizzle-kit emits plain geometry(point)).
ALTER TABLE cities ALTER COLUMN center TYPE geometry(Point, 4326) USING ST_SetSRID(center, 4326);--> statement-breakpoint
ALTER TABLE areas ALTER COLUMN center TYPE geometry(Point, 4326) USING ST_SetSRID(center, 4326);--> statement-breakpoint
ALTER TABLE branches ALTER COLUMN location TYPE geometry(Point, 4326) USING ST_SetSRID(location, 4326);--> statement-breakpoint

-- 2. car_models.search_text = normalised make + model names (both languages).
CREATE OR REPLACE FUNCTION ag_car_models_search_text() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  SELECT ag_normalize_ar(m.name_ar || ' ' || m.name_en || ' ' || NEW.name_ar || ' ' || NEW.name_en)
    INTO NEW.search_text FROM car_makes m WHERE m.id = NEW.make_id;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER car_models_search_text BEFORE INSERT OR UPDATE OF name_ar, name_en, make_id ON car_models
  FOR EACH ROW EXECUTE FUNCTION ag_car_models_search_text();--> statement-breakpoint

-- 3. Audit log is append-only for everyone except the owner (and even then only via migrations).
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;--> statement-breakpoint

-- 4. Row-level security for dealer-scoped tables. Policies apply to agarha_app only;
--    the owner role (API outside dealer transactions, migrations, worker) is unaffected.
GRANT SELECT ON cities, areas, car_makes, car_models, dealers, users TO agarha_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON branches, listings, listing_prices, listing_photos, verification_docs, dealer_members, listing_imports TO agarha_app;--> statement-breakpoint
GRANT SELECT, UPDATE ON leads, reviews, availability_requests TO agarha_app;--> statement-breakpoint
GRANT SELECT ON listing_daily_stats, subscriptions, invoices, featured_placements, plans TO agarha_app;--> statement-breakpoint
GRANT UPDATE (display_name_ar, display_name_en, description_ar, description_en, phone_e164, whatsapp_e164, updated_at) ON dealers TO agarha_app;--> statement-breakpoint
GRANT INSERT ON audit_log TO agarha_app;--> statement-breakpoint
GRANT USAGE ON SEQUENCE audit_log_id_seq TO agarha_app;--> statement-breakpoint

CREATE OR REPLACE FUNCTION ag_current_dealer() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.dealer_id', true), '')::uuid
$$;--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches','listings','verification_docs','dealer_members','leads','reviews',
                           'availability_requests','listing_daily_stats','subscriptions','invoices',
                           'featured_placements','listing_imports']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I TO agarha_app USING (dealer_id = ag_current_dealer()) WITH CHECK (dealer_id = ag_current_dealer())', t || '_dealer_isolation', t);
  END LOOP;
END
$$;--> statement-breakpoint

ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY dealers_self ON dealers TO agarha_app USING (id = ag_current_dealer());--> statement-breakpoint

-- Child tables without dealer_id join through listings.
ALTER TABLE listing_prices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY listing_prices_dealer_isolation ON listing_prices TO agarha_app
  USING (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.dealer_id = ag_current_dealer()))
  WITH CHECK (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.dealer_id = ag_current_dealer()));--> statement-breakpoint
ALTER TABLE listing_photos ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY listing_photos_dealer_isolation ON listing_photos TO agarha_app
  USING (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.dealer_id = ag_current_dealer()))
  WITH CHECK (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.dealer_id = ag_current_dealer()));--> statement-breakpoint

-- Users: agarha_app may only read members of the current dealer (team page).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY users_dealer_members ON users FOR SELECT TO agarha_app
  USING (EXISTS (SELECT 1 FROM dealer_members dm WHERE dm.user_id = users.id AND dm.dealer_id = ag_current_dealer()));
