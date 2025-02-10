import { documents } from "../../database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  return await useDrizzle().select().from(documents).where(eq(documents.organisationId, secure.organisationId)).limit(100)
})
