import { stories } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import { eq, and } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  // Authenticate using API key
  const auth = await requireApiKey(event)
  
  // Get story ID from route parameter
  const storyId = getRouterParam(event, "storyId")
  if (!storyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Story ID is required"
    })
  }
  
  // Check if story exists and belongs to the authenticated site
  const [existingStory] = await useDrizzle()
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
    .limit(1)
  
  if (!existingStory) {
    throw createError({
      statusCode: 404,
      statusMessage: "Story not found"
    })
  }
  
  // Delete the story
  await useDrizzle()
    .delete(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
  
  return {
    success: true,
    message: "Story deleted successfully"
  }
})
