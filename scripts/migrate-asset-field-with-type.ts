import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"
import { inspect } from "util"

function isAssetObject(obj: any): boolean {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.id === "string" &&
    typeof obj.src === "string" &&
    typeof obj.alt === "string" &&
    Object.keys(obj).length > 0
  )
}

function transformAssetFields(data: any, storyId: string, isDryRun: boolean): any {
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (isAssetObject(item) && !item.type) {
        const transformedAsset = {
          ...item,
          type: "image"
        };
        if (isDryRun) {
          console.log(
            `[DRY RUN] Story ${storyId}: Would add 'type: image' to asset object in array: ${inspect(item, { depth: null })} -> ${inspect(transformedAsset, { depth: null })}`
          );
        } else {
          console.log(`Story ${storyId}: Added 'type: image' to asset object in array.`);
        }
        return transformedAsset;
      }
      return transformAssetFields(item, storyId, isDryRun);
    });
  }

  if (typeof data === "object" && data !== null) {
    const newData: { [key: string]: any } = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key]

        if (isAssetObject(value) && !value.type) {
          const transformedAsset = {
            ...value,
            type: "image"
          }
          newData[key] = transformedAsset

          if (isDryRun) {
            console.log(
              `[DRY RUN] Story ${storyId}: Would add 'type: image' to asset object in key '${key}': ${inspect(value, { depth: null })} -> ${inspect(transformedAsset, { depth: null })}`
            )
          } else {
            console.log(`Story ${storyId}: Added 'type: image' to asset object in key '${key}'.`)
          }
        } else if (typeof value === "object" || Array.isArray(value)) {
          newData[key] = transformAssetFields(value, storyId, isDryRun)
        } else {
          newData[key] = value
        }
      }
    }
    return newData
  }

  return data
}

async function migrateStoryContentAssets(isDryRun: boolean) {
  console.log(`Starting story content asset migration... (${isDryRun ? "DRY RUN" : "EXECUTION"})`)
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
        const updatedContent = transformAssetFields(story.content, story.id, isDryRun)
        const updatedContentString = JSON.stringify(updatedContent)

        if (originalContentString !== updatedContentString) {
          contentChanged = true
        } else {
          if (isDryRun) {
          }
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

migrateStoryContentAssets(isDryRun)
  .then(() => {
    console.log("Migration script finished.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration script failed with unhandled error:", err)
    process.exit(1)
  })
