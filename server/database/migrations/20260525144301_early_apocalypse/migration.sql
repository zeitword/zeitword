CREATE TABLE "language_model_usage_credits" (
	"id" uuid PRIMARY KEY,
	"amount" integer NOT NULL,
	"organisation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "language_model_usages" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"organisation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "language_model_usage_credits" ADD CONSTRAINT "language_model_usage_credits_oICjNCIy7qVq_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");--> statement-breakpoint
ALTER TABLE "language_model_usages" ADD CONSTRAINT "language_model_usages_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "language_model_usages" ADD CONSTRAINT "language_model_usages_organisation_id_organisations_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");