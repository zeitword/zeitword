import { z } from "zod"
import { stories } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"

const createStorySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.record(z.any()),
  componentId: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  // Authenticate using API key
  const auth = await requireApiKey(event)
  
  // Validate request body
  const data = await readValidatedBody(event, createStorySchema.parse)
  
  // Check if story with same slug already exists for this site
  const existingStory = await useDrizzle()
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.slug, data.slug),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
    .limit(1)
  
  if (existingStory.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Story with this slug already exists"
    })
  }
  
  // Create the story
  const [story] = await useDrizzle()
    .insert(stories)
    .values({
      slug: data.slug,
      title: data.title,
      content: data.content,
      componentId: data.componentId,
      siteId: auth.siteId,
      organisationId: auth.organisationId
    })
    .returning()
  
  return {
    id: story.id,
    slug: story.slug,
    title: story.title,
    content: story.content,
    componentId: story.componentId,
    siteId: story.siteId,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt
  }
})
