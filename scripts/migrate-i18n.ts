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
      .select({
        id: tables.sites.id,
        name: tables.sites.name,
        defaultLanguage: tables.sites.defaultLanguage
      })
      .from(tables.sites)

    for (const site of sites) {
      console.log(`\nProcessing site: ${site.name} (${site.defaultLanguage}) [${site.id}]`)
      const defaultLang = site.defaultLanguage || "en"

      const stories = await db
        .select({
          id: tables.stories.id,
          slug: tables.stories.slug,
          title: tables.stories.title,
          content: tables.stories.content
        })
        .from(tables.stories)
        .where(eq(tables.stories.siteId, site.id))

      for (const story of stories) {
        try {
          if (!story.content) {
            console.log(
              `  → Story ${story.title} (${story.slug}) [${story.id}]: No content, skipping`
            )
            skippedCount++
            continue
          }

          // Check if content is already in i18n format
          const isAlreadyI18n = Object.keys(story.content).some((key) =>
            /^[a-z]{2}(-[A-Z]{2})?$/.test(key)
          )

          if (isAlreadyI18n) {
            console.log(
              `  → Story ${story.title} (${story.slug}) [${story.id}]: Already i18n, skipping`
            )
            skippedCount++
            continue
          }

          if (!isDryRun) {
            await db
              .update(tables.stories)
              .set({
                content: { [defaultLang]: story.content }
              })
              .where(eq(tables.stories.id, story.id))
            console.log(
              `  → Story ${story.title} (${story.slug}) [${story.id}]: Migrated to ${defaultLang}`
            )
            updatedCount++
          } else {
            console.log(
              `  → Story ${story.title} (${story.slug}) [${story.id}]: Would migrate to ${defaultLang}`
            )
            updatedCount++
          }
        } catch (error: any) {
          console.error(
            `  ❌ Error on story ${story.title} (${story.slug}) [${story.id}]:`,
            error.message || error
          )
          errorCount++
        }
      }
    }

    console.log("\n=== Migration Summary ===")
    console.log(`${isDryRun ? "Would update" : "Updated"}: ${updatedCount} stories`)
    console.log(`Skipped: ${skippedCount} stories`)
    console.log(`Errors: ${errorCount}`)
  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error.message || error)
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

migrateContentToI18n(isDryRun)
  .then(() => {
    console.log("\nMigration complete ✨")
    process.exit(0)
  })
  .catch((err) => {
    console.error("\nMigration failed 💥:", err)
    process.exit(1)
  })
