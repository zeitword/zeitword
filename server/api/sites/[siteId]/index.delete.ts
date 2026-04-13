import { and, eq } from "drizzle-orm"
import {
  sites,
  components,
  componentFields,
  fieldOptions,
  stories
} from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "siteId is required" })

  const db = useDrizzle()

  try {
    return await db.transaction(async (tx) => {
      const [existingSite] = await tx
        .select()
        .from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.organisationId, organisationId)))

      if (!existingSite) {
        throw createError({
          statusCode: 403,
          statusMessage: "Site not found or you do not have permission to delete it."
        })
      }

      await tx
        .delete(stories)
        .where(and(eq(stories.siteId, siteId), eq(stories.organisationId, organisationId)))
      await tx
        .delete(fieldOptions)
        .where(
          and(
            eq(fieldOptions.siteId, siteId),
            eq(fieldOptions.organisationId, organisationId)
          )
        )
      await tx
        .delete(componentFields)
        .where(
          and(
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, organisationId)
          )
        )
      await tx
        .delete(components)
        .where(
          and(eq(components.siteId, siteId), eq(components.organisationId, organisationId))
        )
      const [deletedSite] = await tx
        .delete(sites)
        .where(and(eq(sites.id, siteId), eq(sites.organisationId, organisationId)))
        .returning()

      return deletedSite
    })
  } catch (error) {
    console.error("Error deleting site:", error)
    if (error instanceof Error && error.message.includes("foreign key constraint")) {
      throw createError({
        statusCode: 409,
        statusMessage: "Cannot delete site because it has related data."
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    })
  }
})
