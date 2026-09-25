CREATE TABLE "car_trims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_ar" text NOT NULL,
	"name_en" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "listing_photos_listing_position_key";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "trim_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "car_trims" ADD CONSTRAINT "car_trims_model_id_car_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."car_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "car_trims_model_slug_key" ON "car_trims" USING btree ("model_id","slug");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_trim_id_car_trims_id_fk" FOREIGN KEY ("trim_id") REFERENCES "public"."car_trims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_photos_listing_idx" ON "listing_photos" USING btree ("listing_id","position");