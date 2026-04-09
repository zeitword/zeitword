CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"type" text NOT NULL,
	"src" text NOT NULL,
	"site_id" uuid NOT NULL REFERENCES "sites"("id"),
	"uploaded_by" uuid REFERENCES "users"("id"),
	"organisation_id" uuid NOT NULL REFERENCES "organisations"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
