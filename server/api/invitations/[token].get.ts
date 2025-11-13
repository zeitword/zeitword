import { userInvitations, organisations } from "~~/server/database/schema"
import { isNull } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, "token")
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: "Token is required" })
  }

  // Get invitation details
  const [invitation] = await useDrizzle()
    .select({
      id: userInvitations.id,
      email: userInvitations.email,
      expiresAt: userInvitations.expiresAt,
      acceptedAt: userInvitations.acceptedAt,
      organisationName: organisations.name
    })
    .from(userInvitations)
    .leftJoin(organisations, eq(organisations.id, userInvitations.organisationId))
    .where(and(eq(userInvitations.token, token), isNull(userInvitations.deletedAt)))

  if (!invitation) {
    throw createError({ statusCode: 404, statusMessage: "Invitation not found" })
  }

  // Check if already accepted
  if (invitation.acceptedAt) {
    throw createError({ statusCode: 400, statusMessage: "Invitation has already been accepted" })
  }

  // Check if expired
  if (new Date() > new Date(invitation.expiresAt)) {
    throw createError({ statusCode: 400, statusMessage: "Invitation has expired" })
  }

  return {
    email: invitation.email,
    organisationName: invitation.organisationName
  }
})
