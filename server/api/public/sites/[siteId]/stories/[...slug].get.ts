import { stories, components, sites, storyTranslatedSlugs } from "~~/server/database/schema"
import { eq, and, or } from "drizzle-orm"
import { mergeWithFallback } from "~~/server/utils/content"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const requestedSlug = getRouterParam(event, "slug")
  if (!requestedSlug) throw createError({ statusCode: 400, statusMessage: "Invalid Slug" })

  const requestedLang = getQuery(event).lang as string | undefined

  const slugVariations = [requestedSlug]
  if (!requestedSlug.endsWith("/index")) {
    slugVariations.push(`${requestedSlug}/index`)
  }

  // Get site for default language
  const [site] = await useDrizzle()
    .select({ defaultLanguage: sites.defaultLanguage })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)
  
  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })

  // First try to find story by default slug
  let storyData = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content,
      componentId: stories.componentId
    })
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(
      and(
        eq(components.siteId, siteId),
        or(...slugVariations.map((slug) => eq(stories.slug, slug)))
      )
    )
    .limit(1)

  console.log("Default slug lookup result:", storyData.length > 0 ? "Found" : "Not found")

  // If not found and using non-default language, try to find by translated slug
  if (
    (!storyData || storyData.length === 0) &&
    requestedLang &&
    requestedLang !== site.defaultLanguage
  ) {
    const query = useDrizzle()
      .select({ storyId: storyTranslatedSlugs.storyId })
      .from(storyTranslatedSlugs)
      .where(
        and(
          eq(storyTranslatedSlugs.siteId, siteId),
          eq(storyTranslatedSlugs.languageCode, requestedLang),
          or(...slugVariations.map((slug) => eq(storyTranslatedSlugs.slug, slug)))
        )
      )
      .limit(1)

    const translatedSlugEntry = await query

    if (translatedSlugEntry.length > 0) {
      storyData = await useDrizzle()
        .select({
          id: stories.id,
          slug: stories.slug,
          title: stories.title,
          content: stories.content,
          componentId: stories.componentId
        })
        .from(stories)
        .innerJoin(components, eq(stories.componentId, components.id))
        .where(and(eq(components.siteId, siteId), eq(stories.id, translatedSlugEntry[0].storyId)))
        .limit(1)
    }
  }

  if (!storyData || storyData.length === 0) throw createError({ statusCode: 404, statusMessage: "Story not found" })
  
  const story = storyData[0];
  if (!story.componentId)
    throw createError({ statusCode: 404, statusMessage: "Component not found" })

  const [component] = await useDrizzle()
    .select({ name: components.name })
    .from(components)
    .where(eq(components.id, story.componentId))

  const content = story.content as Record<string, any>
  const defaultContent = content[site.defaultLanguage] || {}
  const requestedContent = content[requestedLang || site.defaultLanguage] || {}

  const mergedContent = mergeWithFallback(defaultContent, requestedContent)

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return {
    ...story,
    content: mergedContent,
    componentName: component.name
  }
})
