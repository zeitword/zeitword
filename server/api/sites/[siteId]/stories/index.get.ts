import { stories, components } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const storiesData = await useDrizzle()
    .select()
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(and(eq(components.siteId, siteId), eq(stories.organisationId, secure.organisationId)))

  const mappedStories = storiesData.map((story) => ({
    ...story.stories,
    component: story.components
  }))

  return mappedStories
})
