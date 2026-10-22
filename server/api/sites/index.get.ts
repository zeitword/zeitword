import { sites } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { organisationId } = await requireAuth(event)

  const result = await useDrizzle()
    .select()
    .from(sites)
    .where(and(eq(sites.organisationId, organisationId), isNull(sites.deletedAt)))
  return result
})
