import { z } from "zod"
import { stories } from "~~/server/database/schema"

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
type Literal = z.infer<typeof literalSchema>
type Json = Literal | { [key: string]: Json } | Json[]

const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]))

const bodySchema = z.object({
  slug: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  content: jsonSchema,
  componentId: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [story] = await useDrizzle()
    .insert(stories)
    .values({
      slug: data.slug,
      title: data.title,
      content: data.content,
      componentId: data.componentId,
      organisationId: secure.organisationId
    })
    .returning()

  return story
})
