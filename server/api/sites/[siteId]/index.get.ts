import { sites } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const id = getRouterParam(event, "siteId")
  if (!id) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const [site] = await useDrizzle()
    .select()
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.organisationId, secure.organisationId)))
  return site
})
