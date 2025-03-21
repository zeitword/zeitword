import { eq } from "drizzle-orm"
import { waitlist } from "~~/server/database/schema"

export default defineEventHandler(async (event) => {
  setHeader(event, "Access-Control-Allow-Origin", "*")
  setHeader(event, "Access-Control-Allow-Methods", "GET")
  setHeader(event, "Access-Control-Allow-Headers", "Content-Type")
  setResponseHeader(event, "Content-Type", "application/json")

  const token = getRouterParam(event, "token")

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Confirmation token is required"
    })
  }

  const [entry] = await useDrizzle()
    .update(waitlist)
    .set({ confirmed: true })
    .where(eq(waitlist.confirmationToken, token))
    .returning()

  if (!entry) {
    throw createError({
      statusCode: 404,
      statusMessage: "Invalid confirmation token"
    })
  }

  return { success: true }
})
