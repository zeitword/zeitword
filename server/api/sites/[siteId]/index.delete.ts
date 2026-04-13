import { and, eq } from "drizzle-orm"
import {
  sites,
  components,
  componentFields,
  fieldOptions,
  stories,
  siteLanguages,
  siteApiKeys,
  storyTranslatedSlugs,
  assets
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

      // Delete in dependency order to avoid FK constraint violations
      await tx
        .delete(storyTranslatedSlugs)
        .where(and(eq(storyTranslatedSlugs.siteId, siteId), eq(storyTranslatedSlugs.organisationId, organisationId)))
      await tx
        .delete(stories)
        .where(and(eq(stories.siteId, siteId), eq(stories.organisationId, organisationId)))
      await tx
        .delete(assets)
        .where(and(eq(assets.siteId, siteId), eq(assets.organisationId, organisationId)))
      await tx
        .delete(fieldOptions)
        .where(and(eq(fieldOptions.siteId, siteId), eq(fieldOptions.organisationId, organisationId)))
      await tx
        .delete(componentFields)
        .where(and(eq(componentFields.siteId, siteId), eq(componentFields.organisationId, organisationId)))
      await tx
        .delete(components)
        .where(and(eq(components.siteId, siteId), eq(components.organisationId, organisationId)))
      await tx
        .delete(siteApiKeys)
        .where(and(eq(siteApiKeys.siteId, siteId), eq(siteApiKeys.organisationId, organisationId)))
      await tx
        .delete(siteLanguages)
        .where(eq(siteLanguages.siteId, siteId))
      const [deletedSite] = await tx
        .delete(sites)
        .where(and(eq(sites.id, siteId), eq(sites.organisationId, organisationId)))
        .returning()

      return deletedSite
    })
  } catch (error: any) {
    if (error.statusCode) throw error
    console.error("Error deleting site:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    })
  }
})
