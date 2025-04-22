import { stories, components, sites } from "~~/server/database/schema"
import { eq, and, or } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const requestedSlug = getRouterParam(event, "slug")
  if (!requestedSlug) throw createError({ statusCode: 400, statusMessage: "Invalid Slug" })

  const requestedLang = getQuery(event).lang as string | undefined

  // Get site's default language
  const [site] = await useDrizzle()
    .select({ defaultLanguage: sites.defaultLanguage })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)

  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })

  const slugVariations = [requestedSlug]
  if (!requestedSlug.endsWith("/index")) {
    slugVariations.push(`${requestedSlug}/index`)
  }

  const [storyData] = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content
    })
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(
      and(
        eq(components.siteId, siteId),
        or(...slugVariations.map((slug) => eq(stories.slug, slug)))
      )
    )

  if (!storyData) throw createError({ statusCode: 404, statusMessage: "Story not found" })

  // Handle language selection
  const content = storyData.content as Record<string, any>
  const selectedLang = requestedLang || site.defaultLanguage

  const responseContent =
    content[selectedLang] || content[site.defaultLanguage] || content["en"] || {}

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return {
    ...storyData,
    content: responseContent
  }
})
