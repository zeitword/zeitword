import { stories, components } from "~~/server/database/schema"
import { eq, and, or, like, notLike } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  const requestedSlug = getRouterParam(event, "slug")

  console.log(
    `[Children Endpoint] Received request for siteId: ${siteId}, requested parent slug: ${requestedSlug}`
  )

  if (!siteId) {
    console.error("[Children Endpoint] Invalid Site ID received.")
    throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })
  }
  if (!requestedSlug) {
    console.error("[Children Endpoint] Invalid Parent Slug received.")
    throw createError({ statusCode: 400, statusMessage: "Invalid Parent Slug" })
  }

  // 1. Find the exact slug of the parent story, handling potential '/index'.
  // A slug ending in '/index' CAN be a parent if stories are structured that way.
  const parentSlugVariations = [requestedSlug]
  if (!requestedSlug.endsWith("/index")) {
    parentSlugVariations.push(`${requestedSlug}/index`)
  }

  console.log(
    `[Children Endpoint] Searching for parent story with siteId: ${siteId} and slugs: ${parentSlugVariations.join(" OR ")}`
  )

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

  // If lookup fails, the parent story doesn't exist with either slug variation for this site.
  if (!parentStory) {
    console.error(
      `[Children Endpoint] Parent story NOT FOUND for siteId: ${siteId}, searched slugs: ${parentSlugVariations.join(", ")}`
    )
    throw createError({ statusCode: 404, statusMessage: "Parent story not found" })
  }

  const actualParentSlug = parentStory.slug // Use the slug found in the DB
  console.log(`[Children Endpoint] Found parent story with actual slug: ${actualParentSlug}`)

  const parentSlugWithSlashWildcard = `${actualParentSlug}/%`
  const parentSlugGrandchildWildcard = `${actualParentSlug}/%/%`

  console.log(
    `[Children Endpoint] Searching for children with siteId: ${siteId}, LIKE '${parentSlugWithSlashWildcard}', NOT LIKE '${parentSlugGrandchildWildcard}'`
  )

  // 2. Fetch direct children using the confirmed parent slug.
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
        eq(components.siteId, siteId), // Ensure children are in the same site
        like(stories.slug, parentSlugWithSlashWildcard), // Starts with parent/
        notLike(stories.slug, parentSlugGrandchildWildcard) // Does NOT have another /
      )
    )

  console.log(
    `[Children Endpoint] Found ${children.length} children for parent slug: ${actualParentSlug}`
  )

  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")

  return children
})
