import { eq, and } from "drizzle-orm"
import { stories } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  const storyId = getRouterParam(event, "storyId")

  if (!siteId || !storyId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid ID" })
  }

  const [story] = await useDrizzle()
    .select({ content: stories.content })
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, organisationId)
      )
    )
    .limit(1)

  if (!story) {
    throw createError({ statusCode: 404, statusMessage: "Story not found" })
  }

  return story.content
})
