import { stories, components, storyTranslatedSlugs } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import { eq, and, inArray, gte, desc, like, type SQL, count } from "drizzle-orm"
import { z } from "zod"
import { withPagination, withPaginationDecorator } from "~~/server/utils/pagination"

const querySchema = z.object({
  ids: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((id) => id.trim()) : undefined)),
  componentTypes: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((type) => type.trim()) : undefined)),
  parent: z.string().optional(),
  updatedSince: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined
      // Parse date string - handle both date-only and date-time formats
      let date: Date
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        // Date-only format (YYYY-MM-DD) - parse as UTC midnight
        const [year, month, day] = val.split("-").map(Number)
        date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
      } else {
        date = new Date(val)
      }
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date format for updatedSince")
      }
      return date
    }),
  offset: z.coerce.number().min(0).optional().default(0),
  limit: z.coerce.number().min(1).max(100).optional().default(50)
})

export default defineEventHandler(async (event) => {
  // Authenticate using API key
  const auth = await requireApiKey(event)

  // Validate query parameters
  const query = await getValidatedQuery(event, querySchema.parse)

  try {
    const conditions: (SQL | undefined)[] = [
      eq(stories.siteId, auth.siteId),
      eq(stories.organisationId, auth.organisationId)
    ]

    if (query.ids?.length) {
      const validIds = query.ids.filter((id) => z.uuid().safeParse(id).success)
      if (validIds.length > 0) {
        conditions.push(inArray(stories.id, validIds))
      }
    }

    if (query.componentTypes?.length) {
      const matchingComponents = await useDrizzle()
        .select({ id: components.id })
        .from(components)
        .where(
          and(
            eq(components.siteId, auth.siteId),
            eq(components.organisationId, auth.organisationId),
            inArray(components.name, query.componentTypes)
          )
        )

      const componentIds = matchingComponents.map((c) => c.id)
      if (componentIds.length > 0) {
        conditions.push(inArray(stories.componentId, componentIds))
      } else {
        return withPaginationDecorator([], 0, query.offset, query.limit)
      }
    }

    if (query.updatedSince) {
      conditions.push(gte(stories.updatedAt, query.updatedSince))
    }

    if (query.parent) {
      const parentSlugPattern = `${query.parent}/%`
      conditions.push(like(stories.slug, parentSlugPattern))
    }

    const whereCondition = and(...conditions)

    const [{ count: totalStories }] = await useDrizzle()
      .select({ count: count() })
      .from(stories)
      .where(whereCondition)

    const storiesQuery = useDrizzle()
      .select({
        id: stories.id,
        slug: stories.slug,
        title: stories.title,
        content: stories.content,
        componentId: stories.componentId,
        componentName: components.name,
        siteId: stories.siteId,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt
      })
      .from(stories)
      .leftJoin(components, eq(stories.componentId, components.id))
      .where(whereCondition)
      .orderBy(desc(stories.updatedAt))

    const storiesData = await withPagination(storiesQuery.$dynamic(), {
      offset: query.offset,
      limit: query.limit
    })

    let translatedSlugs: { storyId: string; languageCode: string; slug: string }[] = []
    if (storiesData.length > 0) {
      translatedSlugs = await useDrizzle()
        .select({
          storyId: storyTranslatedSlugs.storyId,
          languageCode: storyTranslatedSlugs.languageCode,
          slug: storyTranslatedSlugs.slug
        })
        .from(storyTranslatedSlugs)
        .where(
          and(
            inArray(
              storyTranslatedSlugs.storyId,
              storiesData.map((s) => s.id)
            ),
            eq(storyTranslatedSlugs.siteId, auth.siteId),
            eq(storyTranslatedSlugs.organisationId, auth.organisationId)
          )
        )
    }

    const storiesWithTranslatedSlugs = storiesData.map((story) => ({
      ...story,
      translatedSlugs: translatedSlugs.filter((s) => s.storyId === story.id) || []
    }))

    return withPaginationDecorator(
      storiesWithTranslatedSlugs,
      totalStories,
      query.offset,
      query.limit
    )
  } catch (error: any) {
    console.error("Error fetching stories:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "An error occurred while fetching stories."
    })
  }
})
