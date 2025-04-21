import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"

async function migrateContentToI18n(isDryRun: boolean) {
  console.log(`Starting content i18n migration... (${isDryRun ? "DRY RUN" : "EXECUTION"})`)
  const db = useDrizzle()
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    const sites = await db
      .select({ id: tables.sites.id, defaultLanguage: tables.sites.defaultLanguage })
      .from(tables.sites)

    for (const site of sites) {
      const defaultLang = site.defaultLanguage || "en"

      const stories = await db
        .select({ id: tables.stories.id, content: tables.stories.content })
        .from(tables.stories)
        .where(eq(tables.stories.siteId, site.id))

      for (const story of stories) {
        try {
          if (!story.content) {
            console.log(`Story ${story.id}: No content found. Skipping.`)
            skippedCount++
            continue
          }

          // Check if content is already in i18n format
          const contentKeys = Object.keys(story.content)
          const isAlreadyI18n = contentKeys.length === 1 && contentKeys[0].length === 2 // assuming language codes are 2 chars

          if (isAlreadyI18n) {
            console.log(`Story ${story.id}: Already in i18n format. Skipping.`)
            skippedCount++
            continue
          }

          const newContent = {
            [defaultLang]: story.content
          }

          if (!isDryRun) {
            await db
              .update(tables.stories)
              .set({ content: newContent })
              .where(eq(tables.stories.id, story.id))
            updatedCount++
          } else {
            console.log(`[DRY RUN] Would update story ${story.id}`)
            updatedCount++
          }
        } catch (error: any) {
          console.error(`[ERROR] Story ${story.id}: ${error.message || error}`)
          errorCount++
        }
      }
    }

    console.log("\n--- Migration Summary ---")
    console.log(`${isDryRun ? "[DRY RUN] Would update" : "Updated"} ${updatedCount} stories`)
    console.log(`Skipped ${skippedCount} stories`)
    console.log(`Errors: ${errorCount}`)
  } catch (error: any) {
    console.error("[FATAL ERROR]:", error.message || error)
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

migrateContentToI18n(isDryRun)
  .then(() => {
    console.log("Migration complete")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })
