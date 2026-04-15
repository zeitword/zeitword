import { eq, and } from "drizzle-orm"
import { z } from "zod"
import { components } from "~~/server/database/schema"

const bodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  displayName: z.string().min(1).max(255).optional(),
  previewImage: z.string().nullable().optional(),
  previewField: z.string().nullable().optional(),
  renderPreview: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  const componentId = getRouterParam(event, "componentId")
  if (!siteId || !componentId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const data = await readValidatedBody(event, bodySchema.parse)

  // Build partial update — only include fields that were provided
  const updates: Record<string, any> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.displayName !== undefined) updates.displayName = data.displayName
  if (data.previewImage !== undefined) updates.previewImage = data.previewImage
  if (data.previewField !== undefined) updates.previewField = data.previewField
  if (data.renderPreview !== undefined) updates.renderPreview = data.renderPreview

  if (Object.keys(updates).length === 0) {
    throw createError({ statusCode: 400, statusMessage: "No fields to update" })
  }

  const [updatedComponent] = await useDrizzle()
    .update(components)
    .set(updates)
    .where(
      and(
        eq(components.id, componentId),
        eq(components.siteId, siteId),
        eq(components.organisationId, organisationId)
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
