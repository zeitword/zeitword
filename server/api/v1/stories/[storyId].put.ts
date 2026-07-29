import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { components, stories, storyTranslatedSlugs } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import {
  buildValidationSchemaForComponent,
  getSiteComponentResolver,
  throwValidationError
} from "~~/server/utils/validation"
import { mergeWithFallback } from "~~/shared/field-schema"

const updateStorySchema = z.object({
  slug: z
    .stringFormat("slug", /^[a-z0-9/-]+$/)
    .min(1)
    .lowercase()
    .optional(),
  title: z.string().min(1).optional(),
  content: z.any().optional(),
  language: z.string().optional()
})

const paramSchema = z.object({
  storyId: z.uuid()
})

export default defineEventHandler(async (event) => {
  const auth = await requireApiKey(event)

  // Get story ID from route parameter
  const { storyId } = await getValidatedRouterParams(event, paramSchema.parse)
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

  if (!story) {
    throw createError({
      statusCode: 404,
      statusMessage: "Story not found"
    })
  }

  if (!story.componentId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Story has no component"
    })
  }

  // use the site-wide resolver so nested block content is validated even in
  // partial updates where the payload does not contain every block
  const resolveComponent = await getSiteComponentResolver(auth.organisationId, auth.siteId)
  const schema = buildValidationSchemaForComponent(story.componentId, resolveComponent)
  const data = await readValidatedBody(
    event,
    updateStorySchema.extend({ language: z.enum(auth.site.availableLanguages).optional() }).parse
  )
  const language = data.language || auth.site.defaultLanguage

  if (data.content !== undefined) {
    const defaultContent = (story.content as Record<string, unknown>)[auth.site.defaultLanguage]
    const contentToValidate =
      language === auth.site.defaultLanguage
        ? data.content
        : mergeWithFallback(defaultContent, data.content)
    const result = schema.safeParse(contentToValidate)
    if (!result.success) {
      throwValidationError(
        result.error.issues.map((issue) => ({
          path: [
            language,
            ...issue.path.map((part) => (typeof part === "symbol" ? String(part) : part))
          ],
          message: issue.message
        }))
      )
    }
  }

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
        ...story.content,
        ...(data.content ? { [data.language || auth.site.defaultLanguage]: data.content } : {})
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
  if (!updatedStory) {
    throw createError({
      statusCode: 500,
      statusMessage: "Could not update story"
    })
  }

  // Fetch translated slugs for the story
  const translatedSlugsData = await useDrizzle()
    .select({
      languageCode: storyTranslatedSlugs.languageCode,
      slug: storyTranslatedSlugs.slug
    })
    .from(storyTranslatedSlugs)
    .where(
      and(
        eq(storyTranslatedSlugs.storyId, storyId),
        eq(storyTranslatedSlugs.siteId, auth.siteId),
        eq(storyTranslatedSlugs.organisationId, auth.organisationId)
      )
    )

  let componentName = null
  if (updatedStory.componentId) {
    const [component] = await useDrizzle()
      .select({ name: components.name })
      .from(components)
      .where(
        and(
          eq(components.id, updatedStory.componentId),
          eq(components.siteId, auth.siteId),
          eq(components.organisationId, auth.organisationId)
        )
      )
      .limit(1)
    componentName = component?.name
  }

  return {
    id: updatedStory.id,
    slug: updatedStory.slug,
    title: updatedStory.title,
    content: updatedStory.content,
    componentId: updatedStory.componentId,
    componentName: componentName,
    siteId: updatedStory.siteId,
    createdAt: updatedStory.createdAt,
    updatedAt: updatedStory.updatedAt,
    translatedSlugs: translatedSlugsData
  }
})
