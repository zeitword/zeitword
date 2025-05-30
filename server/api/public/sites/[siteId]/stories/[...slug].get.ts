import { stories, components, sites, storyTranslatedSlugs } from "~~/server/database/schema"
import { eq, and, or } from "drizzle-orm"
import { mergeWithFallbackAndTransformLinks } from "~~/server/utils/content"

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

  // If not found and using non-default language, try to find by translated slug
  if (
    (!storyData || storyData.length === 0) &&
    requestedLang &&
    requestedLang !== site.defaultLanguage
  ) {
    // Step 1: Try direct lookup with the translated slug
    const translatedSlugResult = await useDrizzle()
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

    if (translatedSlugResult.length > 0) {
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
        .where(and(eq(components.siteId, siteId), eq(stories.id, translatedSlugResult[0].storyId)))
        .limit(1)
    } else if (requestedSlug.includes("/")) {
      // Step 2: Handle nested paths - check if any part is translated
      const parts = requestedSlug.split("/")
      const firstPart = parts[0]

      // Try to find a translation for the first part or first part with /index
      const firstPartTranslation = await useDrizzle()
        .select({
          storyId: storyTranslatedSlugs.storyId,
          slug: storyTranslatedSlugs.slug
        })
        .from(storyTranslatedSlugs)
        .where(
          and(
            eq(storyTranslatedSlugs.siteId, siteId),
            eq(storyTranslatedSlugs.languageCode, requestedLang),
            or(
              eq(storyTranslatedSlugs.slug, firstPart),
              eq(storyTranslatedSlugs.slug, `${firstPart}/index`)
            )
          )
        )
        .limit(1)

      if (firstPartTranslation.length > 0) {
        // Find the original slug for this story
        const [originalStory] = await useDrizzle()
          .select({ slug: stories.slug })
          .from(stories)
          .where(eq(stories.id, firstPartTranslation[0].storyId))
          .limit(1)

        if (originalStory) {
          const remainingParts = parts.slice(1)

          // Avoid duplicate /index/index in reconstructed slug
          let reconstructedSlug
          if (
            originalStory.slug.endsWith("/index") &&
            remainingParts.length > 0 &&
            remainingParts[0] === "index"
          ) {
            reconstructedSlug = [originalStory.slug, ...remainingParts.slice(1)].join("/")
          } else {
            reconstructedSlug = [originalStory.slug, ...remainingParts].join("/")
          }

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
            .where(and(eq(components.siteId, siteId), eq(stories.slug, reconstructedSlug)))
            .limit(1)
        }
      }
    }
  }

  if (!storyData || storyData.length === 0)
    throw createError({ statusCode: 404, statusMessage: "Story not found" })

  const story = storyData[0]
  if (!story.componentId)
    throw createError({ statusCode: 404, statusMessage: "Component not found" })

  const [component] = await useDrizzle()
    .select({ name: components.name })
    .from(components)
    .where(eq(components.id, story.componentId))

  const content = story.content as Record<string, any>
  const defaultContent = content[site.defaultLanguage] || {}
  const requestedContent = content[requestedLang || site.defaultLanguage] || {}

  const mergedContent = await mergeWithFallbackAndTransformLinks(defaultContent, requestedContent, requestedLang || site.defaultLanguage, siteId)

  // Get all translated slugs for this story
  const translatedSlugs = await useDrizzle()
    .select({
      languageCode: storyTranslatedSlugs.languageCode,
      slug: storyTranslatedSlugs.slug
    })
    .from(storyTranslatedSlugs)
    .where(and(
      eq(storyTranslatedSlugs.storyId, story.id),
      eq(storyTranslatedSlugs.siteId, siteId)
    ))

  // Convert array of translated slugs to object format {en: "slug", de: "slug"}
  const slugsMap: Record<string, string> = {}
  
  // Add the default language slug from the story
  slugsMap[site.defaultLanguage] = story.slug
  
  // Add all translated slugs
  translatedSlugs.forEach(translation => {
    slugsMap[translation.languageCode] = translation.slug
  })

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return {
    ...story,
    content: mergedContent,
    componentName: component.name,
    slugs: slugsMap
  }
})
