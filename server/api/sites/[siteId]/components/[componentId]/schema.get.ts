import { and, eq } from "drizzle-orm"
import { components } from "~~/server/database/schema"
import { getSiteComponentDefinitions } from "~~/server/utils/validation"

/**
 * Returns every component definition of the site in a normalized shape so
 * the client can rebuild the exact same validation schema the server uses.
 */
export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid Site ID" })

  const componentId = getRouterParam(event, "componentId")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "Invalid Component ID" })

  const [component] = await useDrizzle()
    .select({ id: components.id })
    .from(components)
    .where(
      and(
        eq(components.id, componentId),
        eq(components.siteId, siteId),
        eq(components.organisationId, organisationId)
      )
    )
    .limit(1)

  if (!component) throw createError({ statusCode: 404, statusMessage: "Component not found" })

  const definitions = await getSiteComponentDefinitions(organisationId, siteId)

  return {
    componentId: component.id,
    components: definitions
  }
})
