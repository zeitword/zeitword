import { z } from "zod"
import { components } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"

const bodySchema = z.object({
  displayName: z.string().min(1).max(255),
  previewImage: z.string().nullable(),
  previewField: z.string().nullable()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  const componentId = getRouterParam(event, "componentId")
  if (!siteId || !componentId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  const [updatedComponent] = await useDrizzle()
    .update(components)
    .set({
      displayName: data.displayName,
      previewImage: data.previewImage,
      previewField: data.previewField
    })
    .where(
      and(
        eq(components.id, componentId),
        eq(components.siteId, siteId),
        eq(components.organisationId, secure.organisationId)
      )
    )
    .returning()

  if (!updatedComponent) {
    throw createError({
      statusCode: 404,
      statusMessage: "Component not found or you don't have permission to update it"
    })
  }

  return updatedComponent
})
