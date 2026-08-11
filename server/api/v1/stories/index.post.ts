import { z } from "zod"
import { stories } from "~~/server/database/schema"
import { requireApiKey } from "~~/server/utils/api-key-auth"
import {
  buildValidationSchemaForComponent,
  getSiteComponentResolver
} from "~~/server/utils/validation"

const createStorySchema = z.object({
  slug: z
    .stringFormat("slug", /^[a-z0-9/-]+$/)
    .min(1)
    .lowercase(),
  title: z.string().min(1),
  content: z.any(),
  language: z.string().optional(),
  componentId: z.uuid()
})

export default defineEventHandler(async (event) => {
  // Authenticate using API key
  const auth = await requireApiKey(event)

  // first pass: validate structure only so the component schema can be built
  const schemaData = await readValidatedBody(
    event,
    createStorySchema.extend({ language: z.enum(auth.site.availableLanguages) }).parse
  )
  const resolveComponent = await getSiteComponentResolver(auth.organisationId, auth.siteId)
  const schema = buildValidationSchemaForComponent(schemaData.componentId, resolveComponent)
  const fullContentSchema = createStorySchema.extend({
    content: schema,
    language: z.enum(auth.site.availableLanguages).optional()
  })

  const data = await readValidatedBody(event, fullContentSchema.parse)

  // Check if story with same slug already exists for this site and slug
  const existingStory = await useDrizzle()
    .select({ id: stories.id })
    .from(stories)
    .where(
      and(
        eq(stories.slug, data.slug),
        eq(stories.siteId, auth.siteId),
        eq(stories.organisationId, auth.organisationId),
        isNull(stories.deletedAt)
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
      content: {
        [data.language || auth.site.defaultLanguage]: data.content
      },
      componentId: data.componentId,
      siteId: auth.siteId,
      organisationId: auth.organisationId
    })
    .returning()

  if (!story) {
    throw createError({
      statusCode: 500,
      statusMessage: "Could not create story"
    })
  }

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
