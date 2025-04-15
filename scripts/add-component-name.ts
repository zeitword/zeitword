import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"

function processBlocks(
  content: any,
  componentMap: Record<string, string>
): { changed: boolean; count: number } {
  let changed = false
  let count = 0

  // Check if current item is a block with a componentId
  if (content && typeof content === "object" && !Array.isArray(content) && content.componentId) {
    const componentName = componentMap[content.componentId]
    if (componentName && content.componentName !== componentName) {
      content.componentName = componentName
      changed = true
      count++
    }
  }

  // Recursively process all properties
  if (content && typeof content === "object") {
    // Handle arrays
    if (Array.isArray(content)) {
      for (const item of content) {
        const result = processBlocks(item, componentMap)
        if (result.changed) {
          changed = true
          count += result.count
        }
      }
    }
    // Handle objects
    else {
      for (const key in content) {
        if (Object.prototype.hasOwnProperty.call(content, key)) {
          const result = processBlocks(content[key], componentMap)
          if (result.changed) {
            changed = true
            count += result.count
          }
        }
      }
    }
  }

  return { changed, count }
}

async function addComponentNameToBlocks(isDryRun: boolean) {
  console.log(
    `Starting story blocks component name migration... (${isDryRun ? "DRY RUN" : "EXECUTION"})`
  )
  const db = useDrizzle()
  let updatedStoryCount = 0
  let updatedBlockCount = 0
  let skippedStoryCount = 0
  let errorCount = 0

  try {
    // Get all stories
    const stories = await db
      .select({ id: tables.stories.id, content: tables.stories.content })
      .from(tables.stories)

    console.log(`Found ${stories.length} stories to process.`)

    // Get all components for lookup
    const components = await db
      .select({ id: tables.components.id, name: tables.components.name })
      .from(tables.components)

    // Create a mapping of component ID to name for quick lookup
    const componentMap = components.reduce(
      (map, component) => {
        map[component.id] = component.name
        return map
      },
      {} as Record<string, string>
    )

    for (const story of stories) {
      try {
        if (!story.content || typeof story.content !== "object") {
          console.log(`Story ${story.id}: No valid content found. Skipping.`)
          skippedStoryCount++
          continue
        }

        const content = story.content as any
        const result = processBlocks(content, componentMap)

        if (result.changed) {
          if (!isDryRun) {
            await db.update(tables.stories).set({ content }).where(eq(tables.stories.id, story.id))

            console.log(
              `Updated story ${story.id} with component names for ${result.count} blocks.`
            )
          } else {
            console.log(
              `[DRY RUN] Would update story ${story.id} with component names for ${result.count} blocks.`
            )
          }
          updatedStoryCount++
          updatedBlockCount += result.count
        } else {
          skippedStoryCount++
        }
      } catch (error: any) {
        console.error(`[ERROR] Story ${story.id}: ${error.message || error}`)
        errorCount++
      }
    }

    console.log("\n--- Migration Summary ---")
    if (isDryRun) {
      console.log(`[DRY RUN] Would update ${updatedStoryCount} stories.`)
      console.log(`[DRY RUN] Would add componentName to ${updatedBlockCount} blocks.`)
      console.log(`[DRY RUN] Would skip ${skippedStoryCount} stories.`)
    } else {
      console.log(`Updated ${updatedStoryCount} stories.`)
      console.log(`Added componentName to ${updatedBlockCount} blocks.`)
      console.log(`Skipped ${skippedStoryCount} stories.`)
    }
  } catch (error: any) {
    console.error("[FATAL ERROR]:", error.message || error)
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

if (isDryRun) {
  console.log("--- Running in DRY RUN mode ---")
} else {
  console.warn("--- Running in EXECUTION mode ---")
}

addComponentNameToBlocks(isDryRun)
  .then(() => {
    console.log("Migration complete.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration failed:", err)
    process.exit(1)
  })
