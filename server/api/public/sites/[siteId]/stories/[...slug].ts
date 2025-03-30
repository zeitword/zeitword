// zeitword/server/api/public/sites/[siteId]/stories/[...slug].ts
import { stories, components } from "~~/server/database/schema"
import { eq, and, or } from "drizzle-orm" // Import 'or'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const requestedSlug = getRouterParam(event, "slug")
  if (!requestedSlug) throw createError({ statusCode: 400, statusMessage: "Invalid Slug" })

  // Potential slug variations to check in the DB
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
        // Check if stories.slug matches EITHER the original OR the '/index' version
        or(...slugVariations.map((slug) => eq(stories.slug, slug)))
      )
    )

  if (!storyData) throw createError({ statusCode: 404, statusMessage: "Story not found" })

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return storyData
})
