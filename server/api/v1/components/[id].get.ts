import { requireApiKey } from "~~/server/utils/api-key-auth"
import { components } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const auth = await requireApiKey(event)

  const componentId = getRouterParam(event, "id")
  if (!componentId) throw createError({ statusCode: 400, statusMessage: "Invalid Component ID" })

  const [component] = await useDrizzle()
    .select()
    .from(components)
    .where(
      and(
        eq(components.id, componentId),
        eq(components.organisationId, auth.organisationId),
        eq(components.siteId, auth.siteId)
      )
    )
    .limit(1)

  return component
})
