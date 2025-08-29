CREATE TABLE "site_api_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hash" text NOT NULL,
	"site_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "site_api_keys_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "site_languages" ALTER COLUMN "site_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "site_languages" ALTER COLUMN "language_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "site_api_keys" ADD CONSTRAINT "site_api_keys_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_api_keys" ADD CONSTRAINT "site_api_keys_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;