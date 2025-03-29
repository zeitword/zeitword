import { stories } from "~~/server/database/schema"
import { eq, and, like, asc } from "drizzle-orm"
import { sql } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "Invalid Story ID" })

  // Get the slug of the parent story/folder.
  const [parent] = await useDrizzle()
    .select({ slug: stories.slug })
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, secure.organisationId)
      )
    )

  if (!parent) {
    throw createError({ statusCode: 404, statusMessage: "Parent story or folder not found" })
  }

  const parentSlug = parent.slug
  const childSlugPattern = `${parentSlug}/%`
  const grandChildSlugPattern = `${parentSlug}/%/%`

  const childrenList = await useDrizzle()
    .select({
      id: stories.id,
      type: stories.type,
      slug: stories.slug,
      title: stories.title,
      componentId: stories.componentId
    })
    .from(stories)
    .where(
      and(
        eq(stories.siteId, siteId),
        eq(stories.organisationId, secure.organisationId),
        like(stories.slug, childSlugPattern),
        sql`${stories.slug} NOT LIKE ${grandChildSlugPattern}`
      )
    )
    .orderBy(asc(stories.type), asc(stories.title))

  return childrenList
})
