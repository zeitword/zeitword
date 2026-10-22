import { and, eq } from "drizzle-orm"
import { organisationMembers } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  const userId = getRouterParam(event, "userId")!
  return db.transaction(async (tx) => {
    await lockOrganisation(tx, secure.organisationId)
    await requireMembership(tx, secure.userId, secure.organisationId, true)
    const [member] = await tx
      .update(organisationMembers)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(organisationMembers.userId, userId),
          eq(organisationMembers.organisationId, secure.organisationId)
        )
      )
      .returning({ id: organisationMembers.id })
    if (!member) throw createError({ statusCode: 404, statusMessage: "Member not found" })
    return { success: true }
  })
})
