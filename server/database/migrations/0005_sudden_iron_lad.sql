CREATE TYPE "public"."story_type" AS ENUM('story', 'folder');--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "type" "story_type" DEFAULT 'story' NOT NULL;