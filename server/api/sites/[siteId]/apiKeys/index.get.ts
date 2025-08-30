import { siteApiKeys } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

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
