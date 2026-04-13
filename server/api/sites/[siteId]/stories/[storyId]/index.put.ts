import { z } from "zod"
import { stories } from "~~/server/database/schema"

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Literal = z.infer<typeof literalSchema>
type Json = Literal | { [key: string]: Json } | Json[]

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(z.string(), jsonSchema)])
)

const bodySchema = z.object({
  slug: z.string().min(1).max(255).optional(),
  title: z.string().min(1).max(255).optional(),
  content: jsonSchema.optional(),
  componentId: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [currentStory] = await useDrizzle()
    .select()
    .from(stories)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, organisationId)
      )
    )
    .limit(1)

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (data.slug !== undefined) updateData.slug = data.slug
  if (data.title !== undefined) updateData.title = data.title
  if (data.componentId !== undefined) updateData.componentId = data.componentId
  if (data.content !== undefined) {
    updateData.content = {
      ...(currentStory?.content || {}),
      ...((data.content as object) || {})
    }
  }

  const [story] = await useDrizzle()
    .update(stories)
    .set(updateData)
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, organisationId)
      )
    )
    .returning()

  return story
})
