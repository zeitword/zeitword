import { componentFields, components, fieldOptions, stories } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure, session } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "siteId is required" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId)
    throw createError({
      statusCode: 400,
      statusMessage: "componentId is required"
    })

  const db = useDrizzle()

  try {
    return await db.transaction(async (tx) => {
      // 1. Check if the component exists and belongs to the correct site/org.
      const [existingComponent] = await tx
        .select()
        .from(components)
        .where(
          and(
            eq(components.id, componentId),
            eq(components.siteId, siteId),
            eq(components.organisationId, secure.organisationId)
          )
        )

      if (!existingComponent) {
        throw createError({
          statusCode: 404, // 404 is more appropriate for "not found"
          statusMessage: "Component not found or you do not have permission to delete it."
        })
      }

      // 2. Delete related stories.
      await tx.delete(stories).where(
        and(
          eq(stories.siteId, siteId),
          eq(stories.organisationId, secure.organisationId),
          eq(stories.componentId, componentId) // Correctly filter by componentId
        )
      )

      // 3. Delete related fieldOptions directly
      await tx.delete(fieldOptions).where(
        and(
          eq(fieldOptions.componentId, componentId), // Correct: Use componentId directly
          eq(fieldOptions.siteId, siteId),
          eq(fieldOptions.organisationId, secure.organisationId)
        )
      )

      // 4. Delete the componentFields themselves.
      await tx
        .delete(componentFields)
        .where(
          and(
            eq(componentFields.componentId, componentId),
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )

      // 5. Finally, delete the component.
      const [deletedComponent] = await tx
        .delete(components)
        .where(
          and(
            eq(components.id, componentId),
            eq(components.siteId, siteId),
            eq(components.organisationId, secure.organisationId)
          )
        )
        .returning()

      return deletedComponent
    })
  } catch (error) {
    console.error("Error deleting component:", error)
    if (error instanceof Error && error.message.includes("foreign key constraint")) {
      throw createError({
        statusCode: 409,
        statusMessage: "Cannot delete component because it has related data."
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    })
  }
})
