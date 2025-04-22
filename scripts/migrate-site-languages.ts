// zeitword/scripts/migrate-site-languages.ts
import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"

async function migrateSiteLanguages(isDryRun: boolean) {
  console.log(`Starting site languages migration... (${isDryRun ? "DRY RUN" : "EXECUTION"})`)
  const db = useDrizzle()
  let updatedCount = 0
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
      try {
        if (!isDryRun) {
          await db
            .insert(tables.siteLanguages)
            .values({
              siteId: site.id,
              languageCode: site.defaultLanguage
            })
            .onConflictDoNothing()
          console.log(`Added ${site.defaultLanguage} to site: ${site.name} [${site.id}]`)
          updatedCount++
        } else {
          console.log(`Would add ${site.defaultLanguage} to site: ${site.name} [${site.id}]`)
          updatedCount++
        }
      } catch (error: any) {
        console.error(`Error processing site ${site.name} [${site.id}]:`, error.message || error)
        errorCount++
      }
    }

    console.log("\n=== Migration Summary ===")
    console.log(`${isDryRun ? "Would add" : "Added"}: ${updatedCount} site languages`)
    console.log(`Errors: ${errorCount}`)
  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error.message || error)
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

migrateSiteLanguages(isDryRun)
  .then(() => {
    console.log("\nMigration complete ✨")
    process.exit(0)
  })
  .catch((err) => {
    console.error("\nMigration failed 💥:", err)
    process.exit(1)
  })
