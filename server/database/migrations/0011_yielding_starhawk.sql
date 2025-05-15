CREATE TABLE "story_translated_slugs" (
	"story_id" uuid NOT NULL,
	"language_code" text NOT NULL,
	"slug" text NOT NULL,
	"site_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "story_translated_slugs_story_id_language_code_pk" PRIMARY KEY("story_id","language_code")
);
--> statement-breakpoint
ALTER TABLE "story_translated_slugs" ADD CONSTRAINT "story_translated_slugs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_translated_slugs" ADD CONSTRAINT "story_translated_slugs_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_translated_slugs" ADD CONSTRAINT "story_translated_slugs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_translated_slugs" ADD CONSTRAINT "story_translated_slugs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "translated_slug_site_lang_idx" ON "story_translated_slugs" USING btree ("slug","site_id","language_code");