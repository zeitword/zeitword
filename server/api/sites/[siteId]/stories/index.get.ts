import { stories, components } from "~~/server/database/schema"
import { eq, and, notLike, asc } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  try {
    const storiesData = await useDrizzle()
      .select({
        id: stories.id,
        type: stories.type,
        slug: stories.slug,
        title: stories.title,
        componentId: stories.componentId,
        componentDisplayName: components.displayName
      })
      .from(stories)
      .leftJoin(components, eq(stories.componentId, components.id))
      .where(
        and(
          eq(stories.siteId, siteId),
          eq(stories.organisationId, secure.organisationId),
          notLike(stories.slug, "%/%")
        )
      )
      .orderBy(asc(stories.type), asc(stories.title))

    const mappedStories = storiesData.map((row) => ({
      id: row.id,
      type: row.type,
      slug: row.slug,
      title: row.title,
      componentId: row.componentId,
      component: row.componentDisplayName ? { displayName: row.componentDisplayName } : null
    }))

    return mappedStories
  } catch (error: any) {
    console.error("Error fetching root stories:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "An error occurred while fetching root stories."
    })
  }
})
