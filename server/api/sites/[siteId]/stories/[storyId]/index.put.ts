import { z } from "zod"
import { stories } from "~~/server/database/schema"

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Literal = z.infer<typeof literalSchema>
type Json = Literal | { [key: string]: Json } | Json[]

const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
)

const bodySchema = z.object({
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  content: jsonSchema.optional(),
  componentId: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const storyId = getRouterParam(event, "storyId")
  if (!storyId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [story] = await useDrizzle()
    .update(stories)
    .set({
      slug: data.slug,
      title: data.title,
      content: data.content,
      componentId: data.componentId,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(stories.id, storyId),
        eq(stories.siteId, siteId),
        eq(stories.organisationId, secure.organisationId)
      )
    )
    .returning()

  return story
})
