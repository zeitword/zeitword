import { like, notLike, eq, and, or } from "drizzle-orm"
import { stories, components, sites, storyTranslatedSlugs } from "~~/server/database/schema"
import { mergeWithFallback } from "~~/server/utils/content"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  const requestedParentSlug = getRouterParam(event, "parentSlug")
  const requestedLang = getQuery(event).lang as string | undefined

  if (!siteId) {
    console.error("[Story Children] Invalid Site ID received.")
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })
  }
  if (!requestedParentSlug) {
    console.error("[Story Children] Invalid Parent Slug received.")
    throw createError({ statusCode: 400, statusMessage: "Invalid Parent Slug" })
  }

  // Get site for default language
  const [site] = await useDrizzle()
    .select({ defaultLanguage: sites.defaultLanguage })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)

  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })

  const parentSlugVariations = [requestedParentSlug]
  if (!requestedParentSlug.endsWith("/index")) {
    parentSlugVariations.push(`${requestedParentSlug}/index`)
  }

  // Try to find parent story by default slug
  let parentStory = await useDrizzle()
    .select({ slug: stories.slug })
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(
      and(
        eq(components.siteId, siteId),
        or(...parentSlugVariations.map((slug) => eq(stories.slug, slug)))
      )
    )
    .limit(1)

  // If not found and using non-default language, try to find by translated slug
  if (!parentStory && requestedLang && requestedLang !== site.defaultLanguage) {
    const translatedSlugEntry = await useDrizzle()
      .select({ 
        storyId: storyTranslatedSlugs.storyId
      })
      .from(storyTranslatedSlugs)
      .where(
        and(
          eq(storyTranslatedSlugs.siteId, siteId),
          eq(storyTranslatedSlugs.languageCode, requestedLang),
          or(...parentSlugVariations.map(slug => eq(storyTranslatedSlugs.slug, slug)))
        )
      )
      .limit(1)

    if (translatedSlugEntry) {
      parentStory = await useDrizzle()
        .select({ slug: stories.slug })
        .from(stories)
        .innerJoin(components, eq(stories.componentId, components.id))
        .where(
          and(
            eq(components.siteId, siteId),
            eq(stories.id, translatedSlugEntry.storyId)
          )
        )
        .limit(1)
    }
  }

  if (!parentStory) {
    console.error(
      `[Story Children] Parent story NOT FOUND for siteId: ${siteId}, searched slugs: ${parentSlugVariations.join(", ")}`
    )
    throw createError({ statusCode: 404, statusMessage: "Parent story not found" })
  }

  const actualParentSlug = parentStory.slug
  console.log(`[Story Children] Found parent story with actual database slug: ${actualParentSlug}`)

  let basePathForChildren = actualParentSlug
  if (actualParentSlug.endsWith("/index")) {
    basePathForChildren = actualParentSlug.slice(0, -"/index".length)
  }

  const childrenLikePattern = `${basePathForChildren}/%`
  const grandchildrenNotLikePattern = `${basePathForChildren}/%/%`

  const children = await useDrizzle()
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
        like(stories.slug, childrenLikePattern),
        notLike(stories.slug, grandchildrenNotLikePattern)
      )
    )

  // Process each child's content
  const processedChildren = children.map((child) => {
    const content = child.content as Record<string, any>
    const defaultContent = content[site.defaultLanguage] || {}
    const requestedContent = content[requestedLang || site.defaultLanguage] || {}

    return {
      ...child,
      content: mergeWithFallback(defaultContent, requestedContent)
    }
  })

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return processedChildren
})
