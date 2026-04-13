import { z } from "zod"
import { personalAccessTokens } from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

const paramSchema = z.object({
  tokenId: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const { tokenId } = await getValidatedRouterParams(event, paramSchema.parse)

  const [deleted] = await useDrizzle()
    .update(personalAccessTokens)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(personalAccessTokens.id, tokenId),
        eq(personalAccessTokens.userId, secure.userId),
        eq(personalAccessTokens.organisationId, secure.organisationId)
      )
    )
    .returning({ id: personalAccessTokens.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Token not found" })
  }

  return { success: true }
})
