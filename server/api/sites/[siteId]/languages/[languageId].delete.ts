import { and, eq } from "drizzle-orm"
import { siteLanguages, stories, sites } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  const languageCode = getRouterParam(event, "languageId")

  if (!siteId || !languageCode) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID or Language ID" })
  }

  const db = useDrizzle()

  return await db.transaction(async (tx) => {
    // 1. Check if language exists and is not default
    const [site] = await tx
      .select({ defaultLanguage: sites.defaultLanguage })
      .from(sites)
      .where(eq(sites.id, siteId))
      .limit(1)

    if (!site) {
      throw createError({ statusCode: 404, statusMessage: "Site not found" })
    }

    if (site.defaultLanguage === languageCode) {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot delete default language"
      })
    }

    // 2. Delete the language from siteLanguages
    const [deletedLanguage] = await tx
      .delete(siteLanguages)
      .where(and(eq(siteLanguages.languageCode, languageCode), eq(siteLanguages.siteId, siteId)))
      .returning()

    if (!deletedLanguage) {
      throw createError({ statusCode: 404, statusMessage: "Language not found" })
    }

    // 3. Get all stories for this site
    const siteStories = await tx
      .select({
        id: stories.id,
        content: stories.content
      })
      .from(stories)
      .where(eq(stories.siteId, siteId))

    // 4. Remove the language from each story's content
    for (const story of siteStories) {
      const content = story.content as Record<string, any>

      if (!content || typeof content !== "object") {
        console.warn(`Invalid content structure found in story ${story.id}, skipping`)
        continue
      }

      // Remove the language key while keeping all other content
      const { [languageCode]: _removed, ...remainingContent } = content

      await tx
        .update(stories)
        .set({
          content: remainingContent
        })
        .where(eq(stories.id, story.id))
    }

    return { success: true }
  })
})
