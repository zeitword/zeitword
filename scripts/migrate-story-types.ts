import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { sql, eq, and, exists, aliasedTable, or } from "drizzle-orm"
import { uuidv7 } from "uuidv7"

async function migrateStoryTypes() {
  // Check for --dry-run flag
  const isDryRun = process.argv.includes("--dry-run")
  if (isDryRun) {
    console.log("\n-- DRY RUN MODE ENABLED --")
    console.log("No changes will be saved to the database.")
    console.log("The script will report the changes it *would* have made.\n")
  } else {
    console.log("\n-- LIVE RUN MODE --")
    console.log("Changes *will* be saved to the database.\n")
  }

  console.log("Starting story type migration analysis...")
  const db = useDrizzle()
  const childrenStories = aliasedTable(tables.stories, "children")

  try {
    // 1. Find stories that have children (potential folders) - Needed for both modes
    const potentialParents = await db
      .select({
        id: tables.stories.id,
        slug: tables.stories.slug,
        title: tables.stories.title,
        content: tables.stories.content,
        siteId: tables.stories.siteId,
        organisationId: tables.stories.organisationId,
        componentId: tables.stories.componentId,
        type: tables.stories.type // Also select current type
      })
      .from(tables.stories)
      .where(
        exists(
          db
            .select({ _: sql`1` })
            .from(childrenStories)
            .where(
              and(
                sql`${childrenStories.slug} like ${tables.stories.slug} || '/%'`,
                eq(childrenStories.siteId, tables.stories.siteId)
              )
            )
        )
        // Process only stories that are NOT already folders
        // (Avoids processing folders created in previous runs or manually)
        // and(ne(tables.stories.type, 'folder')) // Optional: uncomment if needed
      )

    console.log(`Found ${potentialParents.length} stories with children. Analyzing content...`)

    const storiesToMakeFolderOnly: string[] = []
    const storiesToMakeFolderAndClearContent: string[] = []
    const indexStoriesToCreate: (typeof tables.stories.$inferInsert)[] = []
    const alreadyFolders: string[] = [] // Track stories that are already folders

    // 2. Categorize stories - Needed for both modes
    for (const parent of potentialParents) {
      // Skip if already a folder
      if (parent.type === "folder") {
        alreadyFolders.push(parent.slug)
        continue // Don't process further if already a folder
      }

      const hasMeaningfulContent = parent.content && Object.keys(parent.content).length > 0

      if (!hasMeaningfulContent) {
        storiesToMakeFolderOnly.push(parent.id)
      } else {
        storiesToMakeFolderAndClearContent.push(parent.id)
        const newIndexStory: typeof tables.stories.$inferInsert = {
          id: uuidv7(),
          slug: parent.slug + "/index",
          title: "Index",
          content: parent.content,
          siteId: parent.siteId,
          organisationId: parent.organisationId,
          componentId: parent.componentId,
          type: "story"
        }
        indexStoriesToCreate.push(newIndexStory)
      }
    }

    // Initialize counters and slug arrays
    let updatedFolderCount = 0
    let createdIndexCount = 0
    const updatedFolderSlugs: string[] = []
    const createdIndexSlugs: string[] = []

    // 3. Perform DB operations OR Simulate them
    if (!isDryRun) {
      // LIVE RUN: Perform database changes within a transaction
      console.log("Executing database updates and inserts...")
      await db.transaction(async (tx) => {
        const now = new Date()

        if (storiesToMakeFolderOnly.length > 0) {
          const result = await tx
            .update(tables.stories)
            .set({ type: "folder", updatedAt: now })
            .where(sql`${tables.stories.id} IN ${storiesToMakeFolderOnly}`)
            .returning({ slug: tables.stories.slug })
          updatedFolderCount += result.length
          updatedFolderSlugs.push(...result.map((r) => r.slug))
        }

        if (storiesToMakeFolderAndClearContent.length > 0) {
          const result = await tx
            .update(tables.stories)
            .set({ type: "folder", content: {}, updatedAt: now })
            .where(sql`${tables.stories.id} IN ${storiesToMakeFolderAndClearContent}`)
            .returning({ slug: tables.stories.slug })
          updatedFolderCount += result.length
          updatedFolderSlugs.push(...result.map((r) => r.slug))
        }

        if (indexStoriesToCreate.length > 0) {
          const storiesWithTimestamps = indexStoriesToCreate.map((story) => ({
            ...story,
            createdAt: now,
            updatedAt: now
          }))
          const result = await tx
            .insert(tables.stories)
            .values(storiesWithTimestamps)
            .returning({ slug: tables.stories.slug })
          createdIndexCount = result.length
          createdIndexSlugs.push(...result.map((r) => r.slug))
        }
      })
      console.log("Database operations complete.")
    } else {
      // DRY RUN: Simulate results without touching the DB
      console.log("Simulating database operations (no changes made)...")

      // Simulate updates by finding slugs from potentialParents
      const slugsToMakeFolderOnly = potentialParents
        .filter((p) => storiesToMakeFolderOnly.includes(p.id))
        .map((p) => p.slug)
      const slugsToMakeFolderAndClear = potentialParents
        .filter((p) => storiesToMakeFolderAndClearContent.includes(p.id))
        .map((p) => p.slug)

      updatedFolderSlugs.push(...slugsToMakeFolderOnly, ...slugsToMakeFolderAndClear)
      updatedFolderCount = updatedFolderSlugs.length

      // Simulate inserts using prepared data
      createdIndexSlugs.push(...indexStoriesToCreate.map((s) => s.slug))
      createdIndexCount = createdIndexSlugs.length

      console.log("Simulation complete.")
    }

    // 4. Log summary - Runs in both modes
    const runMode = isDryRun ? "Dry Run" : "Live Run"
    console.log(`\n--- ${runMode} Summary ---`)

    if (alreadyFolders.length > 0) {
      console.log(`  - Skipped ${alreadyFolders.length} stories that are already type 'folder'.`)
      logSlugs("Skipped folder slugs", alreadyFolders)
    }

    if (updatedFolderCount > 0) {
      console.log(`  - Would update ${updatedFolderCount} stories to type 'folder'.`)
      logSlugs("Slugs to update to 'folder'", updatedFolderSlugs)
    } else {
      console.log("  - No stories require updating to type 'folder'.")
    }

    if (createdIndexCount > 0) {
      console.log(
        `  - Would create ${createdIndexCount} new 'index' stories for folders that had content.`
      )
      logSlugs("Slugs for new 'index' stories", createdIndexSlugs)
    } else {
      console.log("  - No new 'index' stories needed.")
    }

    if (updatedFolderCount === 0 && createdIndexCount === 0 && alreadyFolders.length === 0) {
      console.log("  - No stories matched the criteria for migration.")
    }
    console.log("--- End Summary ---\n")
  } catch (error) {
    console.error("Error during story type migration:", error)
    // Exit with error in both modes if something unexpected happens during analysis/DB access
    process.exit(1)
  }
}

function logSlugs(prefix: string, slugs: string[], maxToShow = 5) {
  const count = slugs.length
  if (count === 0) return

  const displayPrefix = `    - ${prefix}`
  if (count <= maxToShow) {
    console.log(`${displayPrefix}: ${slugs.join(", ")}`)
  } else {
    const firstSlugs = slugs.slice(0, maxToShow).join(", ")
    console.log(
      `${displayPrefix} (first ${maxToShow}): ${firstSlugs}, ...and ${count - maxToShow} more.`
    )
  }
}

migrateStoryTypes().catch((error) => {
  // Catch potential errors during top-level execution setup
  console.error("Migration script failed:", error)
  process.exit(1)
})
