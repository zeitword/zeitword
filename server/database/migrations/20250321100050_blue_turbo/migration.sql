CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"confirmation_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email"),
	CONSTRAINT "waitlist_confirmationToken_unique" UNIQUE("confirmation_token")
);
