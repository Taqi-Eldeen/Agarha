-- Extensions, shared SQL functions and the restricted role used for RLS.
-- PostGIS needs a superuser (or rds_superuser / cloudsqlsuperuser) the first time; see docs/runbooks/database.md.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

-- Arabic search normalisation. Keep in sync with normalizeArabic() in packages/schemas/src/arabic.ts.
CREATE OR REPLACE FUNCTION ag_normalize_ar(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT btrim(regexp_replace(lower(
    translate(
      regexp_replace(input, '[ً-ْٰـ]', '', 'g'),
      'أإآٱىة٠١٢٣٤٥٦٧٨٩',
      'اااايه0123456789'
    )), '\s+', ' ', 'g'))
$$;--> statement-breakpoint

-- Restricted role. Dealer-portal transactions run `SET LOCAL ROLE agarha_app` so RLS applies
-- even if the policy layer has a bug. The login role must be a member.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agarha_app') THEN
    CREATE ROLE agarha_app NOLOGIN;
  END IF;
END
$$;--> statement-breakpoint
GRANT agarha_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO agarha_app;
