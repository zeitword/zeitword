CREATE TABLE "site_languages" (
	"site_id" uuid,
	"language_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "site_languages_site_id_language_code_pk" PRIMARY KEY("site_id","language_code")
);
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN "default_language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_languages" ADD CONSTRAINT "site_languages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_languages" ADD CONSTRAINT "site_languages_language_code_languages_code_fk" FOREIGN KEY ("language_code") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_default_language_languages_code_fk" FOREIGN KEY ("default_language") REFERENCES "public"."languages"("code") ON DELETE no action ON UPDATE no action;