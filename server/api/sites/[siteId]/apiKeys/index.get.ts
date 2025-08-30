import { siteApiKeys, sites } from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const [site] = await useDrizzle()
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.organisationId, secure.organisationId)))
  if (!site) throw createError({ statusCode: 404, statusMessage: "Site not found" })

  const apiKeys = await useDrizzle()
    .select({
      id: siteApiKeys.id,
      name: siteApiKeys.name,
      organisationId: siteApiKeys.organisationId
    })
    .from(siteApiKeys)
    .where(
      and(eq(siteApiKeys.siteId, siteId), eq(siteApiKeys.organisationId, secure.organisationId))
    )

  return apiKeys
})
