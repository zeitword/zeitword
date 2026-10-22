CREATE TABLE "organisation_members" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"auth_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organisation_members_user_org_unique" UNIQUE("user_id","organisation_id")
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organisation_id_organisations_id_fk";--> statement-breakpoint
ALTER TABLE "user_invitations" DROP CONSTRAINT IF EXISTS "user_invitations_email_unique";--> statement-breakpoint
ALTER TABLE "user_invitations" DROP CONSTRAINT IF EXISTS "user_invitations_email_key";--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "membership_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Preserve every existing membership. The earliest active user owns each org;
-- archived users retain an inactive membership rather than a disabled identity.
INSERT INTO "organisation_members" (id, user_id, organisation_id, role, created_at, updated_at, deleted_at)
SELECT gen_random_uuid(), id, organisation_id,
  CASE WHEN deleted_at IS NULL AND row_number() OVER (
    PARTITION BY organisation_id ORDER BY (deleted_at IS NOT NULL), created_at, id
  ) = 1 THEN 'owner' ELSE 'member' END,
  created_at, updated_at, deleted_at
FROM "users";
--> statement-breakpoint
UPDATE "users" SET deleted_at = NULL WHERE deleted_at IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "organisation_id";--> statement-breakpoint
ALTER TABLE "auth_sessions" ALTER COLUMN "organisation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_org_email_unique" UNIQUE("organisation_id","email");--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_id_organisations_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");
