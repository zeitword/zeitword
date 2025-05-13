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

  // Parse the incoming translated slugs
  const translatedSlugs = await readBody(event) as Record<string, string>
  if (!translatedSlugs || typeof translatedSlugs !== 'object') {
    throw createError({ statusCode: 400, statusMessage: "Invalid translated slugs format" })
  }

  const db = useDrizzle()
  const langEntries = Object.entries(translatedSlugs)

  // Delete existing translations that are not in the new set
  await db
    .delete(storyTranslatedSlugs)
    .where(
      and(
        eq(storyTranslatedSlugs.storyId, storyId),
        eq(storyTranslatedSlugs.siteId, siteId),
        eq(storyTranslatedSlugs.organisationId, secure.organisationId)
      )
    )

  // Skip empty values and insert new translations
  const slugsToInsert = langEntries
    .filter(([_, slug]) => slug && slug.trim())
    .map(([languageCode, slug]) => ({
      storyId,
      languageCode,
      slug: slug.trim(),
      siteId,
      organisationId: secure.organisationId
    }))

  if (slugsToInsert.length > 0) {
    await db
      .insert(storyTranslatedSlugs)
      .values(slugsToInsert)
      .onConflictDoUpdate({
        target: [storyTranslatedSlugs.storyId, storyTranslatedSlugs.languageCode],
        set: {
          slug: sql`excluded.slug`,
          updatedAt: sql`now()`
        }
      })
  }

  return { success: true }
})