import { users } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const userId = getRouterParam(event, "userId")
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" })
  }

  // Get user to unarchive
  const [userToUnarchive] = await useDrizzle()
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organisationId, secure.organisationId)))

  if (!userToUnarchive) {
    throw createError({ statusCode: 404, statusMessage: "User not found" })
  }

  // Unarchive the user by setting deletedAt to null
  await useDrizzle().update(users).set({ deletedAt: null }).where(eq(users.id, userId))

  return { success: true }
})
