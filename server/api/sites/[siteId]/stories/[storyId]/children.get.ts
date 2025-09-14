import { stories } from "~~/server/database/schema"
import { eq, and, like, asc, count } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { withPagination, withPaginationDecorator } from "~~/server/utils/pagination"

const querySchema = z.object({
  offset: z.coerce.number().min(0).optional().default(0),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "Invalid Story ID" })

  const { offset, limit } = await getValidatedQuery(event, querySchema.parse)

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

  const whereCondition = and(
    eq(stories.siteId, siteId),
    eq(stories.organisationId, secure.organisationId),
    like(stories.slug, childSlugPattern),
    sql`${stories.slug} NOT LIKE ${grandChildSlugPattern}`
  )

  // Get total count for pagination
  const [{ count: totalChildren }] = await useDrizzle()
    .select({ count: count() })
    .from(stories)
    .where(whereCondition)

  // Get paginated children
  const childrenList = await withPagination(
    useDrizzle()
      .select({
        id: stories.id,
        type: stories.type,
        slug: stories.slug,
        title: stories.title,
        componentId: stories.componentId
      })
      .from(stories)
      .where(whereCondition)
      .orderBy(asc(stories.type), asc(stories.title)),
    { offset, limit }
  )

  return withPaginationDecorator(childrenList, totalChildren, offset, limit)
})
