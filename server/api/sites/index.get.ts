import { sites } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const result = await useDrizzle()
    .select()
    .from(sites)
    .where(eq(sites.organisationId, secure.organisationId))
  return result
})
