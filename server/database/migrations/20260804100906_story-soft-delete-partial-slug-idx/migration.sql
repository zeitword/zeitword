DROP INDEX "slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "slug_idx" ON "stories" ("slug","site_id") WHERE ("deleted_at" is null);
