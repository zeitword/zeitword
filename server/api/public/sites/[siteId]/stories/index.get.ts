import { stories, components, sites } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"
import { mergeWithFallback } from "~~/server/utils/content"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const requestedLang = getQuery(event).lang as string | undefined

  // Get site for default language
  const [site] = await useDrizzle()
    .select({ defaultLanguage: sites.defaultLanguage })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)

  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })

  const [storyData] = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content
    })
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(and(eq(components.siteId, siteId), eq(stories.slug, "index")))

  if (!storyData) throw createError({ statusCode: 404, statusMessage: "Story not found" })

  const content = storyData.content as Record<string, any>
  const defaultContent = content[site.defaultLanguage] || {}
  const requestedContent = content[requestedLang || site.defaultLanguage] || {}

  const mergedContent = mergeWithFallback(defaultContent, requestedContent)

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  console.log(`Story ${storyData.id} (${storyData.slug}) content structure:`, {
    defaultLang: site.defaultLanguage,
    requestedLang: requestedLang,
    raw: storyData.content,
    defaultContent,
    requestedContent,
    merged: mergedContent
  })

  return {
    ...storyData,
    content: mergedContent
  }
})
