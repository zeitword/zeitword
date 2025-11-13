import { users } from "~~/server/database/schema"
import { count, isNull } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const userId = getRouterParam(event, "userId")
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" })
  }

  // Cannot archive yourself
  if (userId === secure.userId) {
    throw createError({ statusCode: 400, statusMessage: "Cannot archive yourself" })
  }

  // Get user to archive
  const [userToArchive] = await useDrizzle()
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organisationId, secure.organisationId)))

  if (!userToArchive) {
    throw createError({ statusCode: 404, statusMessage: "User not found" })
  }

  // Check if this is the last remaining active user
  const activeUsers = await useDrizzle()
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.organisationId, secure.organisationId), isNull(users.deletedAt)))

  if (activeUsers[0].count <= 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "Cannot archive the last remaining user in the organization"
    })
  }

  // Archive the user by setting deletedAt
  await useDrizzle().update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId))

  return { success: true }
})
