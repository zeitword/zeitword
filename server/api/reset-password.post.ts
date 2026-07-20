import { z } from "zod"

import { users } from "../database/schema"

const bodySchema = z.object({
  token: z.string(),
  password: z.string()
})

export default defineEventHandler(async (event) => {
  const { password, token } = await readValidatedBody(event, bodySchema.parse)

  const user = await db.query.users.findFirst({
    where: { resetPasswordToken: token }
  })
  if (!user) throw createError({ statusCode: 401, message: "Bad credentials" })

  // Check if both reset password token and expiration date are set
  if (!user.resetPasswordToken || !user.resetPasswordExpiresAt)
    throw createError({ statusCode: 401, message: "Bad credentials" })

  // Check if the token is valid
  if (user.resetPasswordToken !== token)
    throw createError({ statusCode: 401, message: "Bad credentials" })

  // Check if the token has expired
  if (user.resetPasswordExpiresAt < new Date())
    throw createError({ statusCode: 401, message: "Bad credentials" })

  // Update the password
  const hashedPassword = await hashPassword(password)

  await db
    .update(users)
    .set({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null
    })
    .where(eq(users.id, user.id))

  return {}
})
