import { stories, components } from "~~/server/database/schema"
import { eq, and, like } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "Invalid Story ID" })

  // Get the slug of the current story.  We NEED this for the like query.
  const [currentStory] = await useDrizzle()
    .select({ slug: stories.slug })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.organisationId, secure.organisationId)))

  if (!currentStory) {
    throw createError({ statusCode: 404, statusMessage: "Story not found" })
  }

  const currentSlug = currentStory.slug
  const childSlugPattern = `${currentSlug}/%` //  /news/%  matches /news/article1, /news/article2, etc.

  // Fetch stories where the slug STARTS WITH the parent slug + "/"
  const children = await useDrizzle()
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      content: stories.content
      // Add other fields you want, but keep it minimal.
    })
    .from(stories)
    .leftJoin(components, eq(stories.componentId, components.id)) // Left join is correct here
    .where(
      and(
        like(stories.slug, childSlugPattern), // The KEY change: using 'like'
        //this is important so it does only select direct children not children of children
        // we achieve that by checking that there is no other / in the slug after the parent slug
        sql`${stories.slug} NOT LIKE ${currentSlug + "/%/%"}`,
        eq(stories.organisationId, secure.organisationId),
        siteId ? eq(components.siteId, siteId) : undefined // Conditional siteId check
      )
    )

  return children
})
