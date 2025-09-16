import { stories, components } from "~~/server/database/schema"
import { eq, and, notLike, asc, or, ilike, type SQL, count } from "drizzle-orm"
import { z } from "zod"
import { withPagination, withPaginationDecorator } from "~~/server/utils/pagination"

const querySchema = z.object({
  search: z.string().optional(),
  offset: z.coerce.number().min(0).optional().default(0),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const { search, offset, limit } = await getValidatedQuery(event, querySchema.parse)

  try {
    const conditions: (SQL | undefined)[] = [
      eq(stories.siteId, siteId),
      eq(stories.organisationId, secure.organisationId)
    ]

    if (search) {
      conditions.push(or(ilike(stories.title, `%${search}%`), ilike(stories.slug, `%${search}%`)))
    } else {
      conditions.push(notLike(stories.slug, "%/%"))
    }

    const whereCondition = and(...conditions)

    // Get total count for pagination
    const [{ count: totalStories }] = await useDrizzle()
      .select({ count: count() })
      .from(stories)
      .where(whereCondition)

    // Get paginated data with components
    const storiesWithComponents = await withPagination(
      useDrizzle()
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
        .where(whereCondition)
        .orderBy(asc(stories.slug)),
      { offset, limit }
    )

    const mappedStories = storiesWithComponents.map((row: any) => ({
      id: row.id,
      type: row.type,
      slug: row.slug,
      title: row.title,
      componentId: row.componentId,
      component: row.componentDisplayName ? { displayName: row.componentDisplayName } : null
    }))

    return withPaginationDecorator(mappedStories, totalStories, offset, limit)
  } catch (error: any) {
    console.error("Error fetching stories:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "An error occurred while fetching stories."
    })
  }
})
