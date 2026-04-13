CREATE TABLE IF NOT EXISTS "personal_access_tokens" (
	"id" uuid PRIMARY KEY,
	"name" text NOT NULL,
	"hash" text NOT NULL UNIQUE,
	"last_four_chars" text NOT NULL,
	"user_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_organisation_id_organisations_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
