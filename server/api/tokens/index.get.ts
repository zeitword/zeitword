import { personalAccessTokens } from "~~/server/database/schema"
import { and, eq, isNull } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const tokens = await useDrizzle()
    .select({
      id: personalAccessTokens.id,
      name: personalAccessTokens.name,
      lastFourChars: personalAccessTokens.lastFourChars,
      expiresAt: personalAccessTokens.expiresAt,
      lastUsedAt: personalAccessTokens.lastUsedAt,
      createdAt: personalAccessTokens.createdAt
    })
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.userId, secure.userId),
        eq(personalAccessTokens.organisationId, secure.organisationId),
        isNull(personalAccessTokens.deletedAt)
      )
    )
    .orderBy(personalAccessTokens.createdAt)

  return tokens
})
