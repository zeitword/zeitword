import { organisations, users } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const [user] = await useDrizzle()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      organisationId: organisations.id,
      organisationName: organisations.name,
      deletedAt: users.deletedAt
    })
    .from(users)
    .innerJoin(organisations, eq(organisations.id, secure.organisationId))
    .where(eq(users.id, secure.userId))

  // Check if user is archived
  if (user?.deletedAt) {
    throw createError({ statusCode: 401, statusMessage: "Account has been archived" })
  }

  return user
})
