import { users } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  // Get all users in the organization (including archived)
  const orgUsers = await useDrizzle()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt
    })
    .from(users)
    .where(eq(users.organisationId, secure.organisationId))
    .orderBy(users.id)

  return orgUsers
})
