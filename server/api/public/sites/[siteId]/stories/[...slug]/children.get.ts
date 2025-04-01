import { stories, components } from "~~/server/database/schema"
import { eq, and, or, like, notLike } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const requestedSlug = getRouterParam(event, "slug")
  if (!requestedSlug) throw createError({ statusCode: 400, statusMessage: "Invalid Slug" })

  const slugVariations = [requestedSlug]
  if (!requestedSlug.endsWith("/index")) {
    slugVariations.push(`${requestedSlug}/index`)
  }

  const [parentStory] = await useDrizzle()
    .select({ slug: stories.slug })
    .from(stories)
    .innerJoin(components, eq(stories.componentId, components.id))
    .where(
      and(
        eq(components.siteId, siteId),
        or(...slugVariations.map((slug) => eq(stories.slug, slug)))
      )
    )
    .limit(1)

  if (!parentStory) throw createError({ statusCode: 404, statusMessage: "Parent story not found" })

  const parentSlug = parentStory.slug
  const parentSlugWithSlashWildcard = `${parentSlug}/%`
  const parentSlugGrandchildWildcard = `${parentSlug}/%/%`

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
        like(stories.slug, parentSlugWithSlashWildcard),
        notLike(stories.slug, parentSlugGrandchildWildcard)
      )
    )

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return children
})
