import { eq, and, isNull } from "drizzle-orm"
import { stories } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
  const { organisationId } = secure

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
        eq(stories.organisationId, organisationId),
        isNull(stories.deletedAt)
      )
    )
    .limit(1)

  if (!story) {
    throw createError({ statusCode: 404, statusMessage: "Story not found" })
  }

  return story.content
})
