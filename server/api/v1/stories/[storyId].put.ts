import { z } from "zod"
import { stories, storyTranslatedSlugs } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import { eq, and } from "drizzle-orm"
import { getValidationSchemaForComponent } from "~~/server/utils/validation"

const updateStorySchema = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  content: z.any().optional(),
  language: z.string().optional(),
  componentId: z.uuid().optional()
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

  const [story] = await useDrizzle()
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId)
      )
    )
    .limit(1)

  if (!story.componentId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Story has no component"
    })
  }

  // Validate request body
  const schemaData = await readValidatedBody(
    event,
    updateStorySchema.extend({ language: z.enum(auth.site.availableLanguages) }).parse
  )
  const schema = await getValidationSchemaForComponent(
    story.componentId,
    schemaData.content,
    auth.organisationId,
    auth.siteId
  )
  const fullContentSchema = updateStorySchema.extend({
    content: schema
  })

  const data = await readValidatedBody(event, fullContentSchema.parse)
  const language = data.language || auth.site.defaultLanguage

  // Check if slug is different
  if (data.slug && data.slug !== story.slug) {
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

    // If slug changes and it's not the default language, add the translated slug
    if (language !== auth.site.defaultLanguage) {
      await useDrizzle()
        .insert(storyTranslatedSlugs)
        .values({
          storyId,
          languageCode: language,
          slug: data.slug,
          siteId: auth.siteId,
          organisationId: auth.organisationId
        })
        .onConflictDoUpdate({
          target: [storyTranslatedSlugs.storyId, storyTranslatedSlugs.languageCode],
          set: {
            slug: data.slug,
            updatedAt: new Date()
          }
        })

      data.slug = story.slug // don't update default language slug
    }
  }

  // Update the story
  const [updatedStory] = await useDrizzle()
    .update(stories)
    .set({
      ...data,
      content: {
        ...(story.content || {}),
        [data.language || auth.site.defaultLanguage]: data.content
      },
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
