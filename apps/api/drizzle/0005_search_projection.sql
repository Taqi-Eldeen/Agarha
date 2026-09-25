CREATE TABLE "search_documents" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"dealer_id" uuid NOT NULL,
	"available" boolean NOT NULL,
	"city_slug" text NOT NULL,
	"area_slug" text NOT NULL,
	"body_type" "car_body_type" NOT NULL,
	"make_slug" text NOT NULL,
	"model_slug" text NOT NULL,
	"transmission" "transmission" NOT NULL,
	"fuel" "fuel" NOT NULL,
	"seats" smallint NOT NULL,
	"year" smallint NOT NULL,
	"driver_option" "driver_option" NOT NULL,
	"airport_pickup" boolean NOT NULL,
	"price_day" integer NOT NULL,
	"price_week" integer NOT NULL,
	"price_month" integer NOT NULL,
	"deposit" integer NOT NULL,
	"featured_until" timestamp with time zone,
	"last_confirmed_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"location" geometry(point),
	"search_text" text NOT NULL,
	"card" jsonb NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_lead_id_leads_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "lead_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "listing_imports" ADD COLUMN "rows" jsonb;--> statement-breakpoint
CREATE INDEX "search_documents_city_idx" ON "search_documents" USING btree ("city_slug","area_slug");--> statement-breakpoint
CREATE INDEX "search_documents_price_idx" ON "search_documents" USING btree ("price_day");--> statement-breakpoint
CREATE INDEX "search_documents_confirmed_idx" ON "search_documents" USING btree ("last_confirmed_at");--> statement-breakpoint
CREATE INDEX "search_documents_location_gist" ON "search_documents" USING gist ("location");--> statement-breakpoint
CREATE INDEX "search_documents_text_trgm" ON "search_documents" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_documents_dealer_idx" ON "search_documents" USING btree ("dealer_id");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE search_documents ALTER COLUMN location TYPE geometry(Point, 4326) USING ST_SetSRID(location, 4326);
