CREATE TABLE IF NOT EXISTS "user_invitations" (
	"id" uuid PRIMARY KEY,
	"email" text NOT NULL UNIQUE,
	"token" text NOT NULL UNIQUE,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"organisation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_organisation_id_organisations_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
