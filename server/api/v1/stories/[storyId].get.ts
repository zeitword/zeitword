import { stories } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import { eq, and } from "drizzle-orm"
import z from "zod"

const paramSchema = z.object({
  storyId: z.uuid()
})

export default defineEventHandler(async (event) => {
  // Authenticate using API key
  const auth = await requireApiKey(event)

  // Get story ID from route parameter
  const { storyId } = await getValidatedRouterParams(event, paramSchema.parse)
  if (!storyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Story ID is required"
    })
  }

  // Get the story
  const [story] = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content,
      componentId: stories.componentId,
      siteId: stories.siteId,
      createdAt: stories.createdAt,
      updatedAt: stories.updatedAt
    })
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
    .limit(1)

  if (!story) {
    throw createError({
      statusCode: 404,
      statusMessage: "Story not found"
    })
  }

  return story
})
