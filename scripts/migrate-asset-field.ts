import { useDrizzle, tables } from "~~/server/utils/drizzle"
import { eq } from "drizzle-orm"
import { inspect } from "util" // For better object logging
import { LexoRank } from "lexorank" // Import LexoRank

// Helper function to check if a string looks like a potential image URL
function isImageUrl(str: unknown): str is string {
  return typeof str === "string" && (str.startsWith("http://") || str.startsWith("https://"))
}

// Helper function to extract ID from URL
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

// Recursive function to find and transform image fields and image arrays
function transformImageFields(data: any, storyId: string, isDryRun: boolean): any {
  if (Array.isArray(data)) {
    // Handle arrays: Check if it's an array of image URLs
    if (data.length > 0 && data.every(isImageUrl)) {
      if (isDryRun) {
        console.log(
          `[DRY RUN] Story ${storyId}: Found array of image URLs (${data.length} items). Would transform.`
        )
      } else {
        console.log(
          `Story ${storyId}: Found array of image URLs (${data.length} items). Transforming.`
        )
      }

      let prevRank: LexoRank | null = null
      const transformedArray = data
        .map((imageUrl: string) => {
          const id = extractIdFromUrl(imageUrl)
          if (!id) {
            console.warn(
              `Story ${storyId}: Could not extract valid ID from image URL in array, keeping original URL: ${imageUrl}`
            )
            return imageUrl // Keep original if ID extraction fails
          }

          let newRank: LexoRank
          if (prevRank === null) {
            newRank = LexoRank.middle()
          } else {
            newRank = prevRank.genNext()
          }
          prevRank = newRank

          return {
            id: id,
            src: imageUrl,
            alt: "",
            order: newRank.toString()
          }
        })
        .filter((item) => item !== null) // Filter out any nulls if extraction failed badly, though returning the URL is preferred

      // Log the first item of the transformed array for context in dry run
      if (isDryRun && transformedArray.length > 0) {
        console.log(
          `[DRY RUN] Story ${storyId}: Example transformed array item -> ${inspect(transformedArray[0], { depth: null })}`
        )
      }

      return transformedArray
    } else {
      // If it's not an array of image URLs, recurse on each item
      return data.map((item) => transformImageFields(item, storyId, isDryRun))
    }
  }

  if (typeof data === "object" && data !== null) {
    const newData: { [key: string]: any } = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key]

        // Case 1: Single image URL string
        if (key === "image" && isImageUrl(value)) {
          const id = extractIdFromUrl(value)
          if (id) {
            const transformedImage = {
              id: id,
              src: value,
              alt: ""
            }
            newData[key] = transformedImage
            if (isDryRun) {
              console.log(
                `[DRY RUN] Story ${storyId}: Would transform single image URL in key '${key}': ${value} -> ${inspect(transformedImage, { depth: null })}`
              )
            } else {
              console.log(`Story ${storyId}: Transformed single image URL in key '${key}'.`)
            }
          } else {
            newData[key] = value // Keep original if ID extraction fails
            console.warn(
              `Story ${storyId}: Could not extract valid ID from single image URL '${key}', keeping original: ${value}`
            )
          }
        }
        // Case 2: Array (handled by recursion at the start of the function)
        // Case 3: Nested object
        else if (typeof value === "object" || Array.isArray(value)) {
          newData[key] = transformImageFields(value, storyId, isDryRun) // Recurse
        }
        // Case 4: Other property types
        else {
          newData[key] = value // Copy other properties
        }
      }
    }
    return newData
  }

  return data // Return non-object/array types
}

async function migrateStoryContentImages(isDryRun: boolean) {
  console.log(`Starting story content image migration... (${isDryRun ? "DRY RUN" : "EXECUTION"})`)
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
        // Ensure content is processable
        skippedCount++
        continue
      }

      let contentChanged = false
      const originalContentString = JSON.stringify(story.content)

      try {
        const updatedContent = transformImageFields(story.content, story.id, isDryRun)
        const updatedContentString = JSON.stringify(updatedContent)

        if (originalContentString !== updatedContentString) {
          contentChanged = true
        } else {
          if (isDryRun) {
            // Optional: Log if no changes needed during dry run
            // console.log(`[DRY RUN] Story ${story.id}: No transformations needed.`);
          }
          skippedCount++
          continue // Skip update if no changes
        }

        if (!isDryRun) {
          await db
            .update(tables.stories)
            .set({ content: updatedContent })
            .where(eq(tables.stories.id, story.id))

          // console.log(`Updated story ${story.id}.`); // Keep console less noisy during execution
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

// --- Script Execution ---
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")

if (isDryRun) {
  console.log("--- Running in DRY RUN mode ---")
} else {
  console.warn("--- Running in EXECUTION mode. Changes WILL be applied to the database! ---")
  // Consider adding a confirmation prompt here for safety
  // Example: await prompt('Continue? (y/n)');
}

migrateStoryContentImages(isDryRun)
  .then(() => {
    console.log("Migration script finished.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("Migration script failed with unhandled error:", err)
    process.exit(1)
  })
