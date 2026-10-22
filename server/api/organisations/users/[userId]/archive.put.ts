import { and, eq, sql } from "drizzle-orm"
import { organisationMembers, personalAccessTokens, sessions } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  const userId = getRouterParam(event, "userId")!
  return db.transaction(async (tx) => {
    await lockOrganisation(tx, secure.organisationId)
    await requireMembership(tx, secure.userId, secure.organisationId, true)
    const [member] = await tx
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.organisationId, secure.organisationId)
        )
      )
    if (!member) throw createError({ statusCode: 404, statusMessage: "Member not found" })
    if (member.role === "owner")
      throw createError({ statusCode: 400, statusMessage: "Owners cannot be removed" })
    await tx
      .update(organisationMembers)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
        authVersion: sql`${organisationMembers.authVersion} + 1`
      })
      .where(eq(organisationMembers.id, member.id))
    // Keep the account signed in so it can switch to another organisation.
    await tx
      .update(sessions)
      .set({ organisationId: null, membershipVersion: 0 })
      .where(and(eq(sessions.userId, userId), eq(sessions.organisationId, secure.organisationId)))
    await tx
      .update(personalAccessTokens)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(personalAccessTokens.userId, userId),
          eq(personalAccessTokens.organisationId, secure.organisationId)
        )
      )
    return { success: true }
  })
})
