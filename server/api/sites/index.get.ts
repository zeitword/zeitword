import { sites } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const result = await useDrizzle()
    .select()
    .from(sites)
    .where(eq(sites.organisationId, organisationId))
  return result
})
