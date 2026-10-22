import { users, organisationMembers } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireAppSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Get all users in the organization (including archived)
  const orgUsers = await useDrizzle()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: organisationMembers.role,
      createdAt: organisationMembers.createdAt,
      deletedAt: organisationMembers.deletedAt
    })
    .from(users)
    .innerJoin(organisationMembers, eq(organisationMembers.userId, users.id))
    .where(eq(organisationMembers.organisationId, secure.organisationId))
    .orderBy(users.id)

  return orgUsers
})
