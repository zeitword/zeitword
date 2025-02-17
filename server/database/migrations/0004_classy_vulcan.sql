ALTER TABLE "component_fields" ADD COLUMN "site_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "field_options" ADD COLUMN "site_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "site_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "component_fields" ADD CONSTRAINT "component_fields_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_options" ADD CONSTRAINT "field_options_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_slug_unique" UNIQUE("slug");