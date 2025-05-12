import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"
import { inspect } from "util"

function extractIdFromUrl(url: string): string | null {
  try {
    const parts = url.split("/")
    const potentialId = parts[parts.length - 1]
    // Basic check if it looks like a UUID
    if (potentialId && potentialId.includes("-") && potentialId.length > 30) {
      return potentialId
    }
  } catch (e) {
    /* Ignore errors during extraction */
  }
  return null
}

function isVideoObject(obj: unknown): obj is { src: string; type: string } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "src" in obj &&
    typeof obj.src === "string" &&
    "type" in obj &&
    obj.type === "video"
  )
}

function addVideoIds(data: any, storyId: string, isDryRun: boolean): any {
  if (Array.isArray(data)) {
    return data.map((item) => addVideoIds(item, storyId, isDryRun))
  }

  if (typeof data === "object" && data !== null) {
    const newData: { [key: string]: any } = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key]

        if (key === "video" && isVideoObject(value) && !("id" in value)) {
          const id = extractIdFromUrl(value.src)
          if (id) {
            const updatedVideo = {
              ...value,
              id
            }
            newData[key] = updatedVideo
            if (isDryRun) {
              console.log(
                `[DRY RUN] Story ${storyId}: Would add ID to video object in key '${key}': ${inspect(value, { depth: null })} -> ${inspect(updatedVideo, { depth: null })}`
              )
            } else {
              console.log(`Story ${storyId}: Added ID to video object in key '${key}'.`)
            }
          } else {
            newData[key] = value
            console.warn(
              `Story ${storyId}: Could not extract valid ID from video URL in key '${key}', keeping original: ${inspect(value, { depth: null })}`
            )
          }
        } else if (typeof value === "object" || Array.isArray(value)) {
          newData[key] = addVideoIds(value, storyId, isDryRun)
        } else {
          newData[key] = value
        }
      }
    }
    return newData
  }

  return data
}

async function addVideoIdFields(isDryRun: boolean) {
  console.log(`Starting video ID field addition... (${isDryRun ? "DRY RUN" : "EXECUTION"})`)
  const db = useDrizzle()
  let updatedCount = 0
  let skippedCount = 0
  let errorCount = 0

  try {
    const stories = await db
      .select({ id: tables.stories.id, content: tables.stories.content })
      .from(tables.stories)
    console.log(`Found ${stories.length} stories to process.`)

    for (const story of stories) {
      if (!story.content || typeof story.content !== "object") {
        skippedCount++
        continue
      }

      let contentChanged = false
      const originalContentString = JSON.stringify(story.content)

      try {
        const updatedContent = addVideoIds(story.content, story.id, isDryRun)
        const updatedContentString = JSON.stringify(updatedContent)

        if (originalContentString !== updatedContentString) {
          contentChanged = true
        } else {
          skippedCount++
          continue
        }

        if (!isDryRun) {
          await db
            .update(tables.stories)
            .set({ content: updatedContent })
            .where(eq(tables.stories.id, story.id))
          updatedCount++
        } else {
          console.log(`[DRY RUN] Story ${story.id}: Content requires update.`)
          updatedCount++
        }
      } catch (transformError: any) {
        console.error(
          `[ERROR] Story ${story.id}: Error during content processing - ${transformError.message || transformError}. Skipping this story.`
        )
        errorCount++
      }
    }

    console.log("\n--- Migration Summary ---")
    if (isDryRun) {
      console.log(`[DRY RUN] Would attempt to update ${updatedCount} stories.`)
      console.log(`[DRY RUN] Would skip ${skippedCount} stories (no content/changes).`)
      console.log(`[DRY RUN] Encountered errors processing ${errorCount} stories.`)
      console.log("[DRY RUN] No changes were made to the database.")
    } else {
      console.log(`Successfully updated ${updatedCount} stories.`)
      console.log(`Skipped ${skippedCount} stories (no content/changes).`)
      console.log(`Encountered errors processing ${errorCount} stories (check logs above).`)
    }
    console.log("------------------------")
  } catch (error: any) {
    console.error(
      "[FATAL ERROR] An error occurred during the migration setup:",
      error.message || error
    )
    process.exit(1)
  }
}

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

if (isDryRun) {
  console.log("--- Running in DRY RUN mode ---")
} else {
  console.warn("--- Running in EXECUTION mode. Changes WILL be applied to the database! ---")
}

addVideoIdFields(isDryRun)
  .then(() => {
    console.log("Migration script finished.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration script failed with unhandled error:", err)
    process.exit(1)
  })