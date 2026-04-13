import { and, eq } from "drizzle-orm"
import { stories } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "siteId is required" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "storyId is required" })

  const db = useDrizzle()

  console.log("Deleting story:", storyId)

  try {
    return await db.transaction(async (tx) => {
      // 1. Fetch the story (for authorization and existence check).
      const [existingStory] = await tx
        .select()
        .from(stories)
        .where(
          and(
            eq(stories.id, storyId),
            eq(stories.siteId, siteId),
            eq(stories.organisationId, organisationId)
          )
        )

      if (!existingStory) {
        throw createError({
          statusCode: 404,
          statusMessage: "Story not found or you do not have permission to delete it."
        })
      }

      // 2. Delete *ONLY* the story.
      const [deletedStory] = await tx
        .delete(stories)
        .where(
          and(
            eq(stories.id, storyId),
            eq(stories.siteId, siteId),
            eq(stories.organisationId, organisationId)
          )
        )
        .returning()

      return deletedStory
    })
  } catch (error) {
    console.error("Error deleting story:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    })
  }
})
