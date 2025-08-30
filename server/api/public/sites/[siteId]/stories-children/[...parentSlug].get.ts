import { like, notLike, eq, and, or } from "drizzle-orm"
import { stories, components, sites, storyTranslatedSlugs } from "~~/server/database/schema"
import { mergeWithFallback, mergeWithFallbackAndTransformLinks } from "~~/server/utils/content"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  const requestedParentSlug = getRouterParam(event, "parentSlug")
  const requestedLang = getQuery(event).lang as string | undefined

  if (!siteId) {
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })
  }
  if (!requestedParentSlug) {
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

  // Try to find parent story by default slug - first try without components for folder-type stories
  let parentStoryResults = await useDrizzle()
    .select({
      slug: stories.slug,
      id: stories.id
    })
    .from(stories)
    .where(
      and(
        eq(stories.siteId, siteId),
        or(...parentSlugVariations.map((slug) => eq(stories.slug, slug)))
      )
    )
    .limit(1)

  // If not found, try with component join for regular stories
  if (parentStoryResults.length === 0) {
    parentStoryResults = await useDrizzle()
      .select({
        slug: stories.slug,
        id: stories.id
      })
      .from(stories)
      .innerJoin(components, eq(stories.componentId, components.id))
      .where(
        and(
          eq(components.siteId, siteId),
          or(...parentSlugVariations.map((slug) => eq(stories.slug, slug)))
        )
      )
      .limit(1)
  }

  let parentStory = parentStoryResults.length > 0 ? parentStoryResults[0] : undefined
  let originalRequestSlug = requestedParentSlug

  // If not found and using non-default language, try to find by translated slug
  if (!parentStory && requestedLang && requestedLang !== site.defaultLanguage) {
    const translatedSlugResults = await useDrizzle()
      .select({
        storyId: storyTranslatedSlugs.storyId,
        slug: storyTranslatedSlugs.slug
      })
      .from(storyTranslatedSlugs)
      .where(
        and(
          eq(storyTranslatedSlugs.siteId, siteId),
          eq(storyTranslatedSlugs.languageCode, requestedLang),
          or(...parentSlugVariations.map((slug) => eq(storyTranslatedSlugs.slug, slug)))
        )
      )
      .limit(1)

    if (translatedSlugResults.length > 0) {
      const translatedSlugEntry = translatedSlugResults[0]
      originalRequestSlug = translatedSlugEntry.slug

      // First check if the story exists directly (for folder-type stories without components)
      const storyExistsResults = await useDrizzle()
        .select({
          id: stories.id,
          slug: stories.slug
        })
        .from(stories)
        .where(eq(stories.id, translatedSlugEntry.storyId))
        .limit(1)

      if (storyExistsResults.length > 0) {
        parentStory = storyExistsResults[0]
      } else {
        // Try with component join as fallback (for regular stories)
        const parentStoryByIdResults = await useDrizzle()
          .select({
            slug: stories.slug,
            id: stories.id
          })
          .from(stories)
          .innerJoin(components, eq(stories.componentId, components.id))
          .where(and(eq(components.siteId, siteId), eq(stories.id, translatedSlugEntry.storyId)))
          .limit(1)

        if (parentStoryByIdResults.length > 0) {
          parentStory = parentStoryByIdResults[0]
        }
      }
    }
  }

  // Determine the base path regardless of whether we found a parent story or not
  let basePathForChildren = requestedParentSlug

  // If we found an actual parent, use its slug for the base path
  if (parentStory) {
    const actualParentSlug = parentStory.slug

    if (actualParentSlug.endsWith("/index")) {
      basePathForChildren = actualParentSlug.slice(0, -"/index".length)
    } else {
      basePathForChildren = actualParentSlug
    }
  } else if (requestedParentSlug.endsWith("/index")) {
    basePathForChildren = requestedParentSlug.slice(0, -"/index".length)
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

  // For each child, also check if it has a translated slug for the requested language
  const processedChildren = await Promise.all(
    children.map(async (child) => {
      const content = (child.content as Record<string, any>) || {}
      const defaultContent = content[site.defaultLanguage] || {}
      const requestedContent = content[requestedLang || site.defaultLanguage] || {}

      // Get translated slug if available
      let translatedSlug = child.slug
      if (requestedLang && requestedLang !== site.defaultLanguage) {
        const translatedSlugResults = await useDrizzle()
          .select({
            slug: storyTranslatedSlugs.slug
          })
          .from(storyTranslatedSlugs)
          .where(
            and(
              eq(storyTranslatedSlugs.siteId, siteId),
              eq(storyTranslatedSlugs.languageCode, requestedLang),
              eq(storyTranslatedSlugs.storyId, child.id)
            )
          )
          .limit(1)

        if (translatedSlugResults.length > 0) {
          translatedSlug = translatedSlugResults[0].slug
        }
      }

      return {
        ...child,
        translatedSlug,
        content: await mergeWithFallbackAndTransformLinks(
          defaultContent,
          requestedContent,
          requestedLang || site.defaultLanguage,
          siteId
        )
      }
    })
  )

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return processedChildren
})
