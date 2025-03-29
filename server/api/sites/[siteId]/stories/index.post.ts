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
  type: z.enum(["story", "folder"]),
  title: z.string().min(1).max(255),
  content: jsonSchema,
  componentId: z.string().uuid().optional()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  try {
    const [story] = await useDrizzle()
      .insert(stories)
      .values({
        slug: data.slug,
        type: data.type,
        title: data.title,
        content: data.content,
        siteId: siteId,
        componentId: data.componentId,
        organisationId: secure.organisationId
      })
      .returning()
    return story
  } catch (error: any) {
    if (error.code === "23505") {
      throw createError({
        statusCode: 409,
        statusMessage: "Slug already exists",
        data: {
          field: "slug"
        }
      })
    }

    if (error.message) {
      console.error("Drizzle ORM Error:", error.message)
    } else {
      console.error("An unexpected error occurred:", error)
    }

    throw createError({
      statusCode: 500,
      statusMessage: "An error occurred while creating the story."
    })
  }
})
