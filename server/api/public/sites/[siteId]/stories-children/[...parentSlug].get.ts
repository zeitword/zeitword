import { like, notLike } from "drizzle-orm"
import { stories, components } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  const requestedParentSlug = getRouterParam(event, "parentSlug")

  if (!siteId) {
    console.error("[Story Children] Invalid Site ID received.")
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })
  }
  if (!requestedParentSlug) {
    console.error("[Story Children] Invalid Parent Slug received.")
    throw createError({ statusCode: 400, statusMessage: "Invalid Parent Slug" })
  }

  const parentSlugVariations = [requestedParentSlug]
  if (!requestedParentSlug.endsWith("/index")) {
    parentSlugVariations.push(`${requestedParentSlug}/index`)
  }

  const [parentStory] = await useDrizzle()
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
      title: stories.title
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

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return children
})
