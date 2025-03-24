import { componentFields, fieldOptions } from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "siteId is required" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "componentId is required" })

  const fieldId = getRouterParam(event, "fieldId")
  if (!fieldId) throw createError({ statusCode: 400, statusMessage: "fieldId is required" })

  const db = useDrizzle()

  console.log("Deleting field:", fieldId)

  try {
    return await db.transaction(async (tx) => {
      // 1. Check if the field exists and belongs to the correct component/site/org
      const [existingField] = await tx
        .select()
        .from(componentFields)
        .where(
          and(
            eq(componentFields.id, fieldId),
            eq(componentFields.componentId, componentId),
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )

      if (!existingField) {
        throw createError({
          statusCode: 404,
          statusMessage: "Field not found or you do not have permission to delete it."
        })
      }

      // 2. Delete related field options
      await tx.delete(fieldOptions).where(
        and(
          eq(fieldOptions.fieldId, fieldId),
          eq(fieldOptions.componentId, componentId),
          eq(fieldOptions.siteId, siteId),
          eq(fieldOptions.organisationId, secure.organisationId)
        )
      )

      // 3. Delete the field
      const [deletedField] = await tx
        .delete(componentFields)
        .where(
          and(
            eq(componentFields.id, fieldId),
            eq(componentFields.componentId, componentId),
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )
        .returning()

      return deletedField
    })
  } catch (error) {
    console.error("Error deleting field:", error)
    if (error instanceof Error && error.message.includes("foreign key constraint")) {
      throw createError({
        statusCode: 409,
        statusMessage: "Cannot delete field because it has related data."
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    })
  }
}) 