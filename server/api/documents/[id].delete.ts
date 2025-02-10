import { documents } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { user, secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  const documentId = getRouterParam(event, "id")
  if (!documentId) throw createError({ statusCode: 400, message: "Invalid request body" })

  // Check if the user has the required permission to delete the document
  const document = await useDrizzle()
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.organisationId, secure.organisationId)))
    .limit(1)
  if (document.length === 0) throw createError({ statusCode: 404, message: "Document not found" })

  // Soft delete the document
  await useDrizzle().update(documents).set({ updatedAt: new Date(), deletedAt: new Date() }).where(eq(documents.id, documentId)).returning()
  return {}
})
