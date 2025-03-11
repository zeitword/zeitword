import { components } from "~~/server/database/schema"
import { eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "Invalid ID" })

  const componentResults = await useDrizzle()
    .select()
    .from(components)
    .where(eq(components.siteId, siteId))

  return componentResults
})
