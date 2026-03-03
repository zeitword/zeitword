-- Custom SQL migration file, put your code below! --
CREATE TABLE IF NOT EXISTS "languages" (
    "code" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "native_name" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone
);

INSERT INTO "languages" (code, name, native_name, created_at, updated_at)
VALUES ('en', 'English', 'English', NOW(), NOW());
