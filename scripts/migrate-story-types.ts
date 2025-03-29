import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { sql, eq, and, exists, aliasedTable } from "drizzle-orm"

async function migrateStoryTypes() {
  console.log("Starting story type migration...")
  const db = useDrizzle()

  const childrenStories = aliasedTable(tables.stories, "children")

  try {
    const updatedField = "type"
    const updatedValue = "folder"

    // Use .returning() to get back the slugs of updated rows
    const updatedStories = await db
      .update(tables.stories)
      .set({ [updatedField]: updatedValue })
      .where(
        and(
          sql`(${tables.stories.content} IS NULL OR ${tables.stories.content} = '{}'::jsonb)`,
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
        )
      )
      .returning({ slug: tables.stories.slug }) // Specify which field to return

    // Log the count and the slugs
    const updatedCount = updatedStories.length
    console.log(
      `Migration complete. Updated the '${updatedField}' field to '${updatedValue}' for ${updatedCount} stories.`
    )

    if (updatedCount > 0) {
      const slugs = updatedStories.map((story) => story.slug).join(", ")
      // Limit logged slugs if too many, e.g., first 10
      const maxSlugsToShow = 10
      if (updatedCount <= maxSlugsToShow) {
        console.log(`Updated slugs: ${slugs}`)
      } else {
        const firstSlugs = updatedStories
          .slice(0, maxSlugsToShow)
          .map((s) => s.slug)
          .join(", ")
        console.log(
          `Updated slugs (first ${maxSlugsToShow}): ${firstSlugs}, ...and ${updatedCount - maxSlugsToShow} more.`
        )
      }
    }
  } catch (error) {
    console.error("Error during story type migration:", error)
  }
}

migrateStoryTypes().catch((error) => {
  console.error("Migration script failed:", error)
  process.exit(1)
})
