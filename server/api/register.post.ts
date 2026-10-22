import { z } from "zod"

import { accounts, organisations, users } from "../database/schema"

const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    email: z.email().transform((email) => email.toLowerCase()),
    password: z.string().min(8).max(128),
    organisationName: z.string().trim().min(1).max(255)
  })
  .strict()

export default defineEventHandler(async (event) => {
  requireAuthOrigin(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  await limitOnboarding(event)
  const password = await hashPassword(body.password)
  try {
    // The Better Auth instance is bound to this transaction, including its
    // credential lookup and session insert. Cookies are returned only on commit.
    return await db.transaction(async (tx) => {
      const [organisation] = await tx
        .insert(organisations)
        .values({ name: body.organisationName })
        .returning()
      if (!organisation) throw new Error("Failed to create organisation")
      const [user] = await tx
        .insert(users)
        .values({
          name: body.name,
          email: body.email,
          organisationId: organisation.id
        })
        .returning()
      if (!user) throw new Error("Failed to create user")
      await tx.insert(accounts).values({
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password
      })
      const response = await useAuth(tx).api.signInEmail({
        body: { email: body.email, password: body.password },
        headers: authHeaders(event),
        asResponse: true
      })
      if (!response.ok) throw createError({ statusCode: 400, statusMessage: "Registration failed" })
      return response
    })
  } catch (error) {
    if (isUniqueViolation(error))
      throw createError({
        statusCode: 409,
        statusMessage:
          "Unable to register with this email. Try signing in or resetting your password."
      })
    throw error
  }
})
