import { components } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const result = await useDrizzle()
    .select()
    .from(components)
    .where(and(eq(components.siteId, siteId), eq(components.organisationId, secure.organisationId)))
  return result
})
