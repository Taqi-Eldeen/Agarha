CREATE TYPE "public"."availability_request_status" AS ENUM('sent', 'available', 'unavailable', 'expired');--> statement-breakpoint
CREATE TYPE "public"."car_body_type" AS ENUM('sedan', 'hatchback', 'suv', 'crossover', 'minivan', 'van', 'pickup', 'coupe', 'convertible', 'luxury');--> statement-breakpoint
CREATE TYPE "public"."dealer_member_role" AS ENUM('dealer_owner', 'dealer_staff');--> statement-breakpoint
CREATE TYPE "public"."dealer_status" AS ENUM('onboarding', 'pending_review', 'verified', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."delivery_option" AS ENUM('branch_pickup', 'home_delivery', 'hotel_delivery');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."driver_option" AS ENUM('self', 'driver', 'both');--> statement-breakpoint
CREATE TYPE "public"."fuel" AS ENUM('petrol', 'diesel', 'hybrid', 'electric', 'natural_gas');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('validating', 'ready', 'applied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_channel" AS ENUM('whatsapp', 'call');--> statement-breakpoint
CREATE TYPE "public"."lead_outcome" AS ENUM('unknown', 'from_agarha', 'rented', 'not_rented', 'no_reply');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending', 'live', 'paused', 'hidden', 'archived');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('ar', 'en');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending_upload', 'processing', 'ready', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('sms', 'whatsapp', 'push', 'email');--> statement-breakpoint
CREATE TYPE "public"."otp_channel" AS ENUM('sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('customer_sign_in', 'dealer_sign_in', 'dealer_sign_up');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('scam_or_deposit_request', 'car_not_available', 'wrong_price', 'wrong_photos', 'rude_or_unsafe', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."required_doc" AS ENUM('national_id', 'passport', 'egyptian_driving_licence', 'international_driving_permit', 'foreign_driving_licence', 'utility_bill', 'employment_letter');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('customer', 'dealer_owner', 'dealer_staff', 'moderator', 'support', 'admin');--> statement-breakpoint
CREATE TYPE "public"."session_scope" AS ENUM('customer', 'dealer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."social_provider" AS ENUM('google', 'apple', 'google_workspace');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transmission" AS ENUM('automatic', 'manual');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'blocked', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."verification_doc_status" AS ENUM('uploaded', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."verification_doc_type" AS ENUM('commercial_registration', 'tax_card', 'owner_national_id', 'branch_lease', 'other');--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"channel" "otp_channel" NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"max_attempts" smallint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"family_expires_at" timestamp with time zone NOT NULL,
	"scope" "session_scope" NOT NULL,
	"dealer_id" uuid,
	"rotated_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"user_agent" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"totp_last_step" integer,
	"failed_password_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "social_provider" NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_pk" PRIMARY KEY("user_id","role"),
	CONSTRAINT "user_roles_platform_only" CHECK ("user_roles"."role" not in ('dealer_owner', 'dealer_staff'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text,
	"display_name" text,
	"locale" "locale" DEFAULT 'ar' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_e164_format" CHECK ("users"."phone_e164" ~ '^\+[1-9][0-9]{7,14}$')
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"search_text" text GENERATED ALWAYS AS (ag_normalize_ar(coalesce(name_ar, '') || ' ' || coalesce(name_en, ''))) STORED,
	"center" geometry(point),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_makes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "car_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"body_type" "car_body_type" NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"search_text" text GENERATED ALWAYS AS (ag_normalize_ar(coalesce(name_ar, '') || ' ' || coalesce(name_en, ''))) STORED,
	"center" geometry(point),
	"is_active" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"area_id" uuid NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"address_ar" text,
	"address_en" text,
	"location" geometry(point),
	"phone_e164" text,
	"whatsapp_e164" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_id_dealer_key" UNIQUE("id","dealer_id")
);
--> statement-breakpoint
CREATE TABLE "dealer_members" (
	"dealer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "dealer_member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dealer_members_dealer_id_user_id_pk" PRIMARY KEY("dealer_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "dealers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"legal_name" text NOT NULL,
	"display_name_ar" text NOT NULL,
	"display_name_en" text NOT NULL,
	"description_ar" text,
	"description_en" text,
	"commercial_registration_no" text,
	"tax_card_no" text,
	"status" "dealer_status" DEFAULT 'onboarding' NOT NULL,
	"phone_e164" text NOT NULL,
	"whatsapp_e164" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"type" "verification_doc_type" NOT NULL,
	"status" "verification_doc_status" DEFAULT 'uploaded' NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"delete_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "listing_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "import_status" DEFAULT 'validating' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"errors" jsonb,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"status" "media_status" DEFAULT 'pending_upload' NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"blurhash" text,
	"variants" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_photos_max_12" CHECK ("listing_photos"."position" between 0 and 11)
);
--> statement-breakpoint
CREATE TABLE "listing_prices" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"price_day_egp" integer NOT NULL,
	"price_week_egp" integer,
	"price_month_egp" integer,
	"deposit_egp" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_prices_day_positive" CHECK ("listing_prices"."price_day_egp" > 0),
	CONSTRAINT "listing_prices_week_positive" CHECK ("listing_prices"."price_week_egp" is null or "listing_prices"."price_week_egp" > 0),
	CONSTRAINT "listing_prices_month_positive" CHECK ("listing_prices"."price_month_egp" is null or "listing_prices"."price_month_egp" > 0),
	CONSTRAINT "listing_prices_deposit_nonneg" CHECK ("listing_prices"."deposit_egp" >= 0)
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"car_model_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"last_confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transmission" "transmission" NOT NULL,
	"seats" smallint NOT NULL,
	"fuel" "fuel" NOT NULL,
	"year" smallint NOT NULL,
	"color" text NOT NULL,
	"driver_option" "driver_option" NOT NULL,
	"min_age" smallint NOT NULL,
	"required_docs" "required_doc"[] NOT NULL,
	"km_limit_per_day" integer,
	"delivery_options" "delivery_option"[] DEFAULT '{branch_pickup}' NOT NULL,
	"airport_pickup" boolean DEFAULT false NOT NULL,
	"description_ar" text,
	"description_en" text,
	"featured_until" timestamp with time zone,
	"published_at" timestamp with time zone,
	"hidden_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_seats_range" CHECK ("listings"."seats" between 2 and 15),
	CONSTRAINT "listings_min_age_range" CHECK ("listings"."min_age" between 18 and 35),
	CONSTRAINT "listings_year_range" CHECK ("listings"."year" between 1990 and 2100),
	CONSTRAINT "listings_required_docs_nonempty" CHECK (cardinality("listings"."required_docs") > 0),
	CONSTRAINT "listings_km_limit_nonneg" CHECK ("listings"."km_limit_per_day" is null or "listings"."km_limit_per_day" >= 0)
);
--> statement-breakpoint
CREATE TABLE "availability_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_code" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"dealer_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"note" text,
	"status" "availability_request_status" DEFAULT 'sent' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_requests_dates" CHECK ("availability_requests"."end_date" >= "availability_requests"."start_date")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref_code" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"dealer_id" uuid NOT NULL,
	"user_id" uuid,
	"channel" "lead_channel" NOT NULL,
	"locale" "locale" NOT NULL,
	"outcome" "lead_outcome" DEFAULT 'unknown' NOT NULL,
	"outcome_at" timestamp with time zone,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"user_id" uuid,
	"rating" smallint NOT NULL,
	"body" text,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"moderated_by" uuid,
	"moderated_at" timestamp with time zone,
	"dealer_reply" text,
	"dealer_replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text,
	"query" jsonb NOT NULL,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"listing_id" uuid,
	"dealer_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"dealer_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"dealer_id" uuid NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"total_egp" integer NOT NULL,
	"vat_egp" integer NOT NULL,
	"lines" jsonb NOT NULL,
	"gateway" text,
	"gateway_ref" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"code" text PRIMARY KEY NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"price_monthly_egp" integer NOT NULL,
	"max_live_listings" integer,
	"max_team_members" integer DEFAULT 1 NOT NULL,
	"featured_credits_per_month" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dealer_id" uuid NOT NULL,
	"plan_code" text NOT NULL,
	"featured_credits_remaining" integer DEFAULT 0 NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"status" "subscription_status" NOT NULL,
	"current_period_end" timestamp with time zone,
	"gateway" text,
	"gateway_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"recipient" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"template" text NOT NULL,
	"locale" "locale" NOT NULL,
	"provider" text,
	"provider_message_id" text,
	"status" "delivery_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"related_type" text,
	"related_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_topic_channel_pk" PRIMARY KEY("user_id","topic","channel")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"locale" "locale" DEFAULT 'ar' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"actor_role" "role",
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"dealer_id" uuid,
	"metadata" jsonb,
	"ip_hash" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_daily_stats" (
	"listing_id" uuid NOT NULL,
	"dealer_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"whatsapp_contacts" integer DEFAULT 0 NOT NULL,
	"call_contacts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "listing_daily_stats_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_models" ADD CONSTRAINT "car_models_make_id_car_makes_id_fk" FOREIGN KEY ("make_id") REFERENCES "public"."car_makes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealer_members" ADD CONSTRAINT "dealer_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_imports" ADD CONSTRAINT "listing_imports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_imports" ADD CONSTRAINT "listing_imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_prices" ADD CONSTRAINT "listing_prices_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_car_model_id_car_models_id_fk" FOREIGN KEY ("car_model_id") REFERENCES "public"."car_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_branch_dealer_fk" FOREIGN KEY ("branch_id","dealer_id") REFERENCES "public"."branches"("id","dealer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_placements" ADD CONSTRAINT "featured_placements_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_placements" ADD CONSTRAINT "featured_placements_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "featured_placements" ADD CONSTRAINT "featured_placements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_dealer_id_dealers_id_fk" FOREIGN KEY ("dealer_id") REFERENCES "public"."dealers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_code_plans_code_fk" FOREIGN KEY ("plan_code") REFERENCES "public"."plans"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_daily_stats" ADD CONSTRAINT "listing_daily_stats_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_challenges_phone_created_idx" ON "otp_challenges" USING btree ("phone_e164","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identities_provider_subject_key" ON "user_identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_e164_key" ON "users" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "areas_city_slug_key" ON "areas" USING btree ("city_id","slug");--> statement-breakpoint
CREATE INDEX "areas_search_trgm_idx" ON "areas" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "car_makes_slug_key" ON "car_makes" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "car_models_make_slug_key" ON "car_models" USING btree ("make_id","slug");--> statement-breakpoint
CREATE INDEX "car_models_search_trgm_idx" ON "car_models" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "cities_slug_key" ON "cities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "cities_search_trgm_idx" ON "cities" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "branches_dealer_idx" ON "branches" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "branches_area_idx" ON "branches" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "branches_location_gist" ON "branches" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_one_primary_per_dealer" ON "branches" USING btree ("dealer_id") WHERE "branches"."is_primary";--> statement-breakpoint
CREATE INDEX "dealer_members_user_idx" ON "dealer_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dealers_slug_key" ON "dealers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "dealers_status_idx" ON "dealers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verification_docs_dealer_idx" ON "verification_docs" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "verification_docs_status_idx" ON "verification_docs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_photos_listing_position_key" ON "listing_photos" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listing_prices_day_idx" ON "listing_prices" USING btree ("price_day_egp");--> statement-breakpoint
CREATE INDEX "listings_dealer_idx" ON "listings" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "listings_branch_idx" ON "listings" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "listings_model_idx" ON "listings" USING btree ("car_model_id");--> statement-breakpoint
CREATE INDEX "listings_live_confirmed_idx" ON "listings" USING btree ("last_confirmed_at") WHERE "listings"."status" = 'live';--> statement-breakpoint
CREATE UNIQUE INDEX "availability_requests_ref_key" ON "availability_requests" USING btree ("ref_code");--> statement-breakpoint
CREATE INDEX "availability_requests_dealer_idx" ON "availability_requests" USING btree ("dealer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_ref_code_key" ON "leads" USING btree ("ref_code");--> statement-breakpoint
CREATE INDEX "leads_dealer_created_idx" ON "leads" USING btree ("dealer_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_listing_created_idx" ON "leads" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_user_idx" ON "leads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_lead_key" ON "reviews" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "reviews_dealer_status_idx" ON "reviews" USING btree ("dealer_id","status");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_dealer_idx" ON "reports" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "featured_placements_listing_idx" ON "featured_placements" USING btree ("listing_id","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_dealer_idx" ON "invoices" USING btree ("dealer_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_gateway_ref_key" ON "invoices" USING btree ("gateway","gateway_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_gateway_event_key" ON "payment_events" USING btree ("gateway","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_dealer_key" ON "subscriptions" USING btree ("dealer_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_provider_msg_idx" ON "notification_deliveries" USING btree ("provider","provider_message_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_created_idx" ON "notification_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "push_tokens_user_idx" ON "push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_dealer_idx" ON "audit_log" USING btree ("dealer_id","created_at");