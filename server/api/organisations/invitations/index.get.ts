import { userInvitations, users } from "~~/server/database/schema"
import { isNull } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Get pending invitations (not accepted and not deleted)
  const invitations = await useDrizzle()
    .select({
      id: userInvitations.id,
      email: userInvitations.email,
      invitedBy: userInvitations.invitedBy,
      invitedByName: users.name,
      expiresAt: userInvitations.expiresAt,
      createdAt: userInvitations.createdAt
    })
    .from(userInvitations)
    .leftJoin(users, eq(users.id, userInvitations.invitedBy))
    .where(
      and(
        eq(userInvitations.organisationId, secure.organisationId),
        isNull(userInvitations.acceptedAt),
        isNull(userInvitations.deletedAt)
      )
    )
    .orderBy(userInvitations.createdAt)

  return invitations
})
