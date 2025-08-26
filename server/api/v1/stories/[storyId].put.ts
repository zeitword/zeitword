import { z } from "zod"
import { stories } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import { eq, and } from "drizzle-orm"

const updateStorySchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  content: z.record(z.any()).optional(),
  componentId: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  // Authenticate using API key
  const auth = await requireApiKey(event)
  
  // Get story ID from route parameter
  const storyId = getRouterParam(event, "storyId")
  if (!storyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Story ID is required"
    })
  }
  
  // Validate request body
  const data = await readValidatedBody(event, updateStorySchema.parse)
  
  // Check if story exists and belongs to the authenticated site
  const [existingStory] = await useDrizzle()
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
    .limit(1)
  
  if (!existingStory) {
    throw createError({
      statusCode: 404,
      statusMessage: "Story not found"
    })
  }
  
  // If slug is being updated, check for conflicts
  if (data.slug && data.slug !== existingStory.id) {
    const slugConflict = await useDrizzle()
      .select({ id: stories.id })
      .from(stories)
      .where(
        and(
          eq(stories.slug, data.slug),
          eq(stories.siteId, auth.siteId),
          eq(stories.id, storyId) // Exclude current story
        )
      )
      .limit(1)
    
    if (slugConflict.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: "Story with this slug already exists"
      })
    }
  }
  
  // Update the story
  const [updatedStory] = await useDrizzle()
    .update(stories)
    .set({
      ...data,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
    .returning()
  
  return {
    id: updatedStory.id,
    slug: updatedStory.slug,
    title: updatedStory.title,
    content: updatedStory.content,
    componentId: updatedStory.componentId,
    siteId: updatedStory.siteId,
    createdAt: updatedStory.createdAt,
    updatedAt: updatedStory.updatedAt
  }
})
