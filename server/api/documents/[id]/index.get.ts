import { documents } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  const documentId = getRouterParam(event, "id")
  if (!documentId) throw createError({ statusCode: 404, message: "Document not found" })

  const [document] = await useDrizzle()
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organisationId, secure.organisationId)))

  return document
})
