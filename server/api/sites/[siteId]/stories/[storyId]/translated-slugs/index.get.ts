import { eq, and } from "drizzle-orm"
import { storyTranslatedSlugs, stories } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  const storyId = getRouterParam(event, "storyId")

  if (!siteId || !storyId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid parameters" })
  }

  // Verify the story exists and belongs to the user's organization
  const [storyExists] = await useDrizzle()
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, secure.organisationId)
      )
    )
    .limit(1)

  if (!storyExists) {
    throw createError({ statusCode: 404, statusMessage: "Story not found" })
  }

  // Get all translated slugs for this story
  const translatedSlugs = await useDrizzle()
    .select({
      languageCode: storyTranslatedSlugs.languageCode,
      slug: storyTranslatedSlugs.slug
    })
    .from(storyTranslatedSlugs)
    .where(
      and(
        eq(storyTranslatedSlugs.storyId, storyId),
        eq(storyTranslatedSlugs.siteId, siteId),
        eq(storyTranslatedSlugs.organisationId, secure.organisationId)
      )
    )

  // Transform to a key-value object for easier consumption in the frontend
  const slugsObject = translatedSlugs.reduce(
    (acc, { languageCode, slug }) => {
      acc[languageCode] = slug
      return acc
    },
    {} as Record<string, string>
  )

  return slugsObject
})
