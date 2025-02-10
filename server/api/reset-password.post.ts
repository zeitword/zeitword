import { users } from "../database/schema"
import { nanoid } from "nanoid"
import { z } from "zod"
import type { H3Event } from "h3"

const bodySchema = z.object({
  password: z.string(),
  token: z.string(),
})

export default defineEventHandler(async (event) => {
  const { password, token } = await readValidatedBody(event, bodySchema.parse)

  const result = await useDrizzle().select().from(users).where(eq(users.resetPasswordToken, token)).limit(1)
  if (result.length !== 1) throw createError({ statusCode: 401, message: "Bad credentials" })
  const user = result[0]

  // Check if both reset password token and expiration date are set
  if (!user.resetPasswordToken || !user.resetPasswordExpiresAt) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Check if the token is valid
  if (user.resetPasswordToken !== token) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Check if the token has expired
  if (user.resetPasswordExpiresAt < new Date()) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Update the password
  const hashedPassword = await hashPassword(password)

  await useDrizzle().update(users).set({ password: hashedPassword, resetPasswordToken: null, resetPasswordExpiresAt: null }).where(eq(users.id, user.id))

  return {}
})
