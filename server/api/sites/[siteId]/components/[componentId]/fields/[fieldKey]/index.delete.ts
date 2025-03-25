import { and, eq } from "drizzle-orm"
import { componentFields, fieldOptions } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "siteId is required" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "componentId is required" })

  const fieldKey = getRouterParam(event, "fieldKey")
  if (!fieldKey) throw createError({ statusCode: 400, statusMessage: "fieldKey is required" })

  try {
    return await useDrizzle().transaction(async (tx) => {
      // Check if the componentField exists and belongs to the correct site/org.
      const [existingField] = await tx
        .select()
        .from(componentFields)
        .where(
          and(
            eq(componentFields.componentId, componentId),
            eq(componentFields.fieldKey, fieldKey),
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )

      if (!existingField) {
        throw createError({
          statusCode: 404,
          statusMessage: "Component Field not found or you do not have permission to delete it."
        })
      }

      // Delete related fieldOptions.
      await tx
        .delete(fieldOptions)
        .where(
          and(
            eq(fieldOptions.componentId, componentId),
            eq(fieldOptions.fieldKey, fieldKey),
            eq(fieldOptions.siteId, siteId),
            eq(fieldOptions.organisationId, secure.organisationId)
          )
        )

      // Delete the componentField.
      const [deletedField] = await tx
        .delete(componentFields)
        .where(
          and(
            eq(componentFields.componentId, componentId),
            eq(componentFields.fieldKey, fieldKey),
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )
        .returning()

      return deletedField
    })
  } catch (error) {
    console.error("Error deleting component field:", error)
    throw createError({ statusCode: 500, statusMessage: "Internal Server Error" })
  }
})
