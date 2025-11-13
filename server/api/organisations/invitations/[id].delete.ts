import { userInvitations } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const invitationId = getRouterParam(event, "id")
  if (!invitationId) {
    throw createError({ statusCode: 400, statusMessage: "Invitation ID is required" })
  }

  // Verify invitation belongs to the organization
  const [invitation] = await useDrizzle()
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.id, invitationId),
        eq(userInvitations.organisationId, secure.organisationId)
      )
    )

  if (!invitation) {
    throw createError({ statusCode: 404, statusMessage: "Invitation not found" })
  }

  // Soft delete the invitation
  await useDrizzle()
    .update(userInvitations)
    .set({ deletedAt: new Date() })
    .where(eq(userInvitations.id, invitationId))

  return { success: true }
})
