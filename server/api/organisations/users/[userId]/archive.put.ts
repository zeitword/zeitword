import { and, count, eq, isNull, sql } from "drizzle-orm"
import { organisations, personalAccessTokens, sessions, users } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  const userId = getRouterParam(event, "userId")!
  if (userId === secure.userId)
    throw createError({ statusCode: 400, statusMessage: "Cannot archive yourself" })
  return db.transaction(async (tx) => {
    // Serialise membership changes within the organisation.
    await tx
      .select({ id: organisations.id })
      .from(organisations)
      .where(eq(organisations.id, secure.organisationId))
      .for("update")
    const [actor] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, secure.userId),
          eq(users.organisationId, secure.organisationId),
          isNull(users.deletedAt)
        )
      )
    if (!actor) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })
    const [user] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organisationId, secure.organisationId)))
    if (!user) throw createError({ statusCode: 404, statusMessage: "User not found" })
    const [active] = await tx
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.organisationId, secure.organisationId), isNull(users.deletedAt)))
    if (!user.deletedAt && (!active || active.count <= 1))
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot archive the last remaining user"
      })
    await tx
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        authVersion: sql`${users.authVersion} + 1`
      })
      .where(eq(users.id, userId))
    await tx.delete(sessions).where(eq(sessions.userId, userId))
    await tx
      .update(personalAccessTokens)
      .set({ deletedAt: new Date() })
      .where(eq(personalAccessTokens.userId, userId))
    return { success: true }
  })
})
